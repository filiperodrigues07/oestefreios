import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { idempotency, limparIdempotencia } from '../middlewares/idempotency.js';

let criadas = 0;

function montar() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: String(req.header('x-user') ?? 'u1') } as never;
    next();
  });
  app.post('/os', idempotency, async (_req, res) => {
    criadas++;
    await new Promise((r) => setTimeout(r, 30));
    res.status(201).json({ success: true, data: { n: criadas } });
  });
  app.post('/falha', idempotency, (_req, res) => {
    criadas++;
    res.status(500).json({ success: false });
  });
  return app;
}

describe('idempotency', () => {
  beforeEach(() => {
    limparIdempotencia();
    criadas = 0;
  });

  it('mesma chave devolve a resposta original sem executar de novo', async () => {
    const app = montar();
    const a = await request(app).post('/os').set('Idempotency-Key', 'k1').send({});
    const b = await request(app).post('/os').set('Idempotency-Key', 'k1').send({});
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(b.body).toEqual(a.body);
    expect(b.headers['idempotent-replay']).toBe('true');
    expect(criadas).toBe(1);
  });

  it('duplo clique simultâneo: o segundo recebe 409 e só 1 é criado', async () => {
    const app = montar();
    const [a, b] = await Promise.all([
      request(app).post('/os').set('Idempotency-Key', 'k2').send({}),
      request(app).post('/os').set('Idempotency-Key', 'k2').send({}),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(criadas).toBe(1);
  });

  it('chave é por usuário e sem chave não interfere', async () => {
    const app = montar();
    await request(app).post('/os').set('Idempotency-Key', 'k3').set('x-user', 'a').send({});
    await request(app).post('/os').set('Idempotency-Key', 'k3').set('x-user', 'b').send({});
    await request(app).post('/os').send({});
    await request(app).post('/os').send({});
    expect(criadas).toBe(4);
  });

  it('erro 500 não é guardado: retry com a mesma chave executa de novo', async () => {
    const app = montar();
    await request(app).post('/falha').set('Idempotency-Key', 'k4').send({});
    await request(app).post('/falha').set('Idempotency-Key', 'k4').send({});
    expect(criadas).toBe(2);
  });
});
