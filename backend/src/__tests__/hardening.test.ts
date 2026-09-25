import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { trustProxyHops } from '../config/proxy.js';
import { esqueciSenhaEmailLimiter } from '../middlewares/rateLimiter.js';
import { escaparHtml } from '../utils/html.js';

describe('trustProxyHops', () => {
  it('confia em 1 proxy (nginx) só em produção', () => {
    expect(trustProxyHops('production')).toBe(1);
    expect(trustProxyHops('development')).toBe(0);
    expect(trustProxyHops('test')).toBe(0);
  });

  it('com 1 salto, req.ip vem do X-Forwarded-For; sem confiança, é ignorado', async () => {
    const montar = (hops: number) => {
      const app = express();
      app.set('trust proxy', hops);
      app.get('/ip', (req, res) => res.json({ ip: req.ip }));
      return app;
    };
    const atras = await request(montar(1)).get('/ip').set('X-Forwarded-For', '203.0.113.9');
    expect(atras.body.ip).toBe('203.0.113.9');
    const semProxy = await request(montar(0)).get('/ip').set('X-Forwarded-For', '203.0.113.9');
    expect(semProxy.body.ip).not.toBe('203.0.113.9');
  });
});

describe('escaparHtml', () => {
  it('neutraliza tags e aspas', () => {
    expect(escaparHtml(`<img src=x onerror="a('b')">&`)).toBe('&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;');
  });
});

describe('esqueciSenhaEmailLimiter', () => {
  it('limita por e-mail (3/h) sem afetar outro e-mail', async () => {
    const app = express();
    app.use(express.json());
    app.post('/f', esqueciSenhaEmailLimiter, (_req, res) => res.json({ ok: true }));
    const email = `limite-${Date.now()}@teste.local`;
    for (let i = 0; i < 3; i++) expect((await request(app).post('/f').send({ email })).status).toBe(200);
    expect((await request(app).post('/f').send({ email })).status).toBe(429);
    expect((await request(app).post('/f').send({ email: `outro-${Date.now()}@teste.local` })).status).toBe(200);
  });
});

describe('X-Request-Id', () => {
  it('toda resposta da API devolve o id usado no log (código para suporte)', async () => {
    const { app } = await import('../app.js');
    const res = await request(app).get('/api/rota-que-nao-existe');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});
