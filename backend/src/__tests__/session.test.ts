import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../auth/password.js';
import { app } from '../app.js';
import { env } from '../config/env.js';
import { pool } from '../database/postgres/client.js';

let adminToken: string;
let operationalToken: string;

beforeAll(async () => {
  const [admin, operational] = await Promise.all([
    request(app).post('/api/auth/login').send({ email: env.DEV_ADMIN_EMAIL, password: env.DEV_ADMIN_PASSWORD }),
    request(app).post('/api/auth/login').send({ email: 'mecanico@dev.local', password: 'Mecanico@123456' }),
  ]);
  expect(admin.status).toBe(200);
  expect(operational.status).toBe(200);
  adminToken = admin.body.data.accessToken;
  operationalToken = operational.body.data.accessToken;
});

afterAll(async () => { await pool.end(); });

describe('sessões ativas', () => {
  it('lista todos os usuários sem expor token ou hash', async () => {
    const response = await request(app).get('/api/sessions').set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    expect(response.body.data.some((item: { userEmail: string }) => item.userEmail === env.DEV_ADMIN_EMAIL)).toBe(true);
    expect(response.body.data.some((item: { userEmail: string }) => item.userEmail === 'mecanico@dev.local')).toBe(true);
    expect(JSON.stringify(response.body)).not.toMatch(/tokenHash|passwordHash|refreshToken/);
  });

  it('nega acesso sem SYSTEM_SETTINGS', async () => {
    const response = await request(app).get('/api/sessions').set('Authorization', `Bearer ${operationalToken}`);
    expect(response.status).toBe(403);
    const audit = await request(app).get('/api/audit-logs').set('Authorization', `Bearer ${operationalToken}`);
    expect(audit.status).toBe(403);
  });

  it('não altera sessão inexistente', async () => {
    const response = await request(app).delete(`/api/sessions/${randomUUID()}`).set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(404);
  });

  it('revoga sessão individual e depois todas as sessões da pessoa', async () => {
    const userId = randomUUID();
    const email = `sessao-${userId}@test.local`;
    const password = 'Teste@123456';
    const role = await pool.query<{ id: string }>('SELECT id FROM roles LIMIT 1');
    await pool.query('INSERT INTO users (id, name, email, password_hash, role_id) VALUES ($1, $2, $3, $4, $5)',
      [userId, 'Teste Sessão', email, await hashPassword(password), role.rows[0]?.id]);
    try {
      const first = await request(app).post('/api/auth/login').set('User-Agent', 'Firefox/130.0').send({ email, password });
      const second = await request(app).post('/api/auth/login').set('User-Agent', 'Chrome/130.0').send({ email, password });
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      const firstCookie = (first.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
      const secondCookie = (second.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
      const sessions = await request(app).get('/api/sessions').set('Authorization', `Bearer ${adminToken}`);
      const mine = sessions.body.data.filter((session: { userId: string }) => session.userId === userId);
      expect(mine).toHaveLength(2);

      const revokeOne = await request(app).delete(`/api/sessions/${mine[0].id}`).set('Authorization', `Bearer ${adminToken}`);
      expect(revokeOne.status).toBe(200);
      const revoked = await pool.query<{ revoked_at: Date | null }>('SELECT revoked_at FROM refresh_tokens WHERE id = $1', [mine[0].id]);
      expect(revoked.rows[0]?.revoked_at).not.toBeNull();
      const state = await pool.query<{ session_version: number }>('SELECT session_version FROM users WHERE id = $1', [userId]);
      expect(state.rows[0]?.session_version).toBe(1);
      const oldAccess = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${second.body.data.accessToken}`);
      expect(oldAccess.status).toBe(401);

      const survivingCookie = mine[0].browser?.includes('Firefox') ? secondCookie : firstCookie;
      const revokedCookie = mine[0].browser?.includes('Firefox') ? firstCookie : secondCookie;
      const revokedRefresh = await request(app).post('/api/auth/refresh').set('Cookie', revokedCookie);
      expect(revokedRefresh.status).toBe(401);
      expect(revokedRefresh.body.error.code).toBe('REFRESH_TOKEN_INVALID');
      const refresh = await request(app).post('/api/auth/refresh').set('Cookie', survivingCookie);
      expect(refresh.status).toBe(200);
      const freshCookie = (refresh.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;

      const revokeAll = await request(app).delete(`/api/users/${userId}/sessions`).set('Authorization', `Bearer ${adminToken}`);
      expect(revokeAll.status).toBe(200);
      const denied = await request(app).post('/api/auth/refresh').set('Cookie', freshCookie);
      expect(denied.status).toBe(401);
      const version = await pool.query<{ session_version: number }>('SELECT session_version FROM users WHERE id = $1', [userId]);
      expect(version.rows[0]?.session_version).toBe(2);
      const audit = await pool.query<{ event: string }>(
        `SELECT event FROM audit_logs WHERE entity_type = 'SESSION' AND entity_id = $1 ORDER BY created_at`, [userId]);
      expect(audit.rows.map(row => row.event)).toEqual(expect.arrayContaining(['SESSION_FORCE_LOGOUT', 'SESSION_FORCE_LOGOUT_ALL']));
    } finally {
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    }
  });
});
