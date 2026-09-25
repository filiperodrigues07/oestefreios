import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '../auth/password.js';
import { app } from '../app.js';
import { pool } from '../database/postgres/client.js';

const userId = randomUUID();
const email = `fluxo-${userId}@test.local`;
const password = 'Teste@123456';

function cookieDe(res: request.Response): string {
  return (res.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
}

async function login() {
  return request(app).post('/api/auth/login').send({ email, password });
}

beforeAll(async () => {
  const role = await pool.query<{ id: string }>('SELECT id FROM roles LIMIT 1');
  await pool.query('INSERT INTO users (id, name, email, password_hash, role_id) VALUES ($1, $2, $3, $4, $5)', [
    userId, 'Teste Fluxo', email, await hashPassword(password), role.rows[0]?.id,
  ]);
});

afterAll(async () => {
  await pool.query('DELETE FROM audit_logs WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  await pool.end();
});

describe('login', () => {
  it('senha errada e e-mail inexistente dão a mesma resposta (sem enumerar usuários)', async () => {
    const errada = await request(app).post('/api/auth/login').send({ email, password: 'Errada@123456' });
    const inexistente = await request(app).post('/api/auth/login').send({ email: `nao-${userId}@test.local`, password });
    expect(errada.status).toBe(401);
    expect(inexistente.status).toBe(401);
    expect(inexistente.body.error).toEqual(errada.body.error);
  });

  it('não emite refresh token na falha e registra LOGIN_FAILURE', async () => {
    const errada = await request(app).post('/api/auth/login').send({ email, password: 'Errada@123456' });
    expect(errada.headers['set-cookie']).toBeUndefined();
    const { rows } = await pool.query("SELECT 1 FROM audit_logs WHERE user_id = $1 AND event = 'LOGIN_FAILURE'", [userId]);
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe('refresh token', () => {
  it('rotaciona: o token novo funciona e o antigo, reapresentado, derruba a família inteira', async () => {
    const primeiro = await login();
    expect(primeiro.status).toBe(200);
    const cookieA = cookieDe(primeiro);

    const rotacionado = await request(app).post('/api/auth/refresh').set('Cookie', cookieA);
    expect(rotacionado.status).toBe(200);
    const cookieB = cookieDe(rotacionado);
    expect(cookieB).not.toBe(cookieA);

    // Reuso do token já rotacionado = indício de roubo.
    const reuso = await request(app).post('/api/auth/refresh').set('Cookie', cookieA);
    expect(reuso.status).toBe(401);
    expect(reuso.body.error.code).toBe('REFRESH_TOKEN_REUSED');

    // O token legítimo mais novo também foi revogado junto.
    const aposReuso = await request(app).post('/api/auth/refresh').set('Cookie', cookieB);
    expect(aposReuso.status).toBe(401);

    const { rows } = await pool.query("SELECT 1 FROM audit_logs WHERE user_id = $1 AND event = 'TOKEN_REUSE_DETECTED'", [userId]);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('logout revoga o refresh token', async () => {
    const sessao = await login();
    const cookie = cookieDe(sessao);
    const saiu = await request(app).post('/api/auth/logout').set('Cookie', cookie).set('Authorization', `Bearer ${sessao.body.data.accessToken}`);
    expect(saiu.status).toBeLessThan(300);
    const depois = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(depois.status).toBe(401);
  });

  it('sem cookie ou com lixo no cookie é recusado', async () => {
    expect((await request(app).post('/api/auth/refresh')).status).toBe(401);
    expect((await request(app).post('/api/auth/refresh').set('Cookie', 'refreshToken=lixo')).status).toBe(401);
  });
});

describe('usuário desativado', () => {
  it('não loga e o refresh existente deixa de valer', async () => {
    const sessao = await login();
    const cookie = cookieDe(sessao);
    await pool.query('UPDATE users SET is_active = false WHERE id = $1', [userId]);
    try {
      expect((await login()).status).toBe(401);
      expect((await request(app).post('/api/auth/refresh').set('Cookie', cookie)).status).toBe(401);
    } finally {
      await pool.query('UPDATE users SET is_active = true WHERE id = $1', [userId]);
    }
  });
});
