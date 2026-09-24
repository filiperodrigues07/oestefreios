import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../auth/password.js';
import { app } from '../app.js';
import { env } from '../config/env.js';
import { pool } from '../database/postgres/client.js';
import { decidirVaga, statusDePresenca, usuarioIsentoDeLimite } from '../services/license.service.js';

describe('statusDePresenca', () => {
  const agora = Date.now();
  it('classifica online, ocioso e offline', () => {
    expect(statusDePresenca(null, agora)).toBe('offline');
    expect(statusDePresenca(new Date(agora - 60_000), agora)).toBe('online');
    expect(statusDePresenca(new Date(agora - 10 * 60_000), agora)).toBe('ocioso');
    expect(statusDePresenca(new Date(agora - 2 * 3600_000), agora)).toBe('offline');
  });
});

describe('decidirVaga (regra pura da licença)', () => {
  it('ocupa vaga abaixo do limite e bloqueia quando lotado', () => {
    expect(decidirVaga({ online: 4, limite: 5, isento: false, jaOnline: false })).toBe('ocupar');
    expect(decidirVaga({ online: 5, limite: 5, isento: false, jaOnline: false })).toBe('bloquear');
    expect(decidirVaga({ online: 9, limite: 5, isento: false, jaOnline: false })).toBe('bloquear');
  });

  it('quem já está online só renova, mesmo com o limite cheio', () => {
    expect(decidirVaga({ online: 5, limite: 5, isento: false, jaOnline: true })).toBe('renovar');
  });

  it('administrador (isento) entra com as vagas cheias', () => {
    expect(decidirVaga({ online: 5, limite: 5, isento: true, jaOnline: false })).toBe('ocupar');
  });

  it('limite 0 significa sem limite', () => {
    expect(decidirVaga({ online: 50, limite: 0, isento: false, jaOnline: false })).toBe('ocupar');
  });

  it('só o proprietário (super admin) é isento', () => {
    expect(usuarioIsentoDeLimite(true)).toBe(true);
    expect(usuarioIsentoDeLimite(false)).toBe(false);
  });
});

describe('sessão única por usuário e presença', () => {
  const userId = randomUUID();
  const email = `licenca-${userId}@test.local`;
  const password = 'Teste@123456';
  let adminToken: string;

  beforeAll(async () => {
    const role = await pool.query<{ id: string }>("SELECT id FROM roles WHERE name = 'Mecânico'");
    await pool.query('INSERT INTO users (id, name, email, password_hash, role_id) VALUES ($1, $2, $3, $4, $5)', [
      userId,
      'Teste Licença',
      email,
      await hashPassword(password),
      role.rows[0]?.id,
    ]);
    const admin = await request(app).post('/api/auth/login').send({ email: env.DEV_ADMIN_EMAIL, password: env.DEV_ADMIN_PASSWORD });
    adminToken = admin.body.data.accessToken;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await pool.end();
  });

  it('segundo login derruba o primeiro dispositivo e o novo token já nasce válido', async () => {
    vi.stubEnv('SINGLE_SESSION_PER_USER', 'true');
    const first = await request(app).post('/api/auth/login').send({ email, password });
    expect(first.status).toBe(200);
    const firstCookie = (first.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;

    const second = await request(app).post('/api/auth/login').send({ email, password });
    expect(second.status).toBe(200);

    const oldAccess = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${first.body.data.accessToken}`);
    expect(oldAccess.status).toBe(401);
    expect(oldAccess.body.error.code).toBe('SESSION_REVOKED');

    const oldRefresh = await request(app).post('/api/auth/refresh').set('Cookie', firstCookie);
    expect(oldRefresh.status).toBe(401);

    const newAccess = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${second.body.data.accessToken}`);
    expect(newAccess.status).toBe(200);

    const audit = await pool.query<{ event: string }>('SELECT event FROM audit_logs WHERE user_id = $1', [userId]);
    expect(audit.rows.map((row) => row.event)).toContain('SESSION_REPLACED');
  });

  it('login marca presença e logout libera a vaga na hora', async () => {
    const login = await request(app).post('/api/auth/login').send({ email, password });
    expect(login.status).toBe(200);
    const cookie = (login.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;

    const online = await pool.query<{ last_seen_at: Date | null }>('SELECT last_seen_at FROM users WHERE id = $1', [userId]);
    expect(online.rows[0]?.last_seen_at).not.toBeNull();

    const license = await request(app).get('/api/sessions/license').set('Authorization', `Bearer ${adminToken}`);
    expect(license.status).toBe(200);
    const linha = license.body.data.usuarios.find((u: { id: string }) => u.id === userId);
    expect(linha.status).toBe('online');
    expect(linha.sessao).not.toBeNull();

    const logout = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(logout.status).toBeLessThan(300);
    const offline = await pool.query<{ last_seen_at: Date | null }>('SELECT last_seen_at FROM users WHERE id = $1', [userId]);
    expect(offline.rows[0]?.last_seen_at).toBeNull();
  });

  it('presença expirada (ociosa) deixa de contar como online', async () => {
    await pool.query("UPDATE users SET last_seen_at = now() - interval '2 hours' WHERE id = $1", [userId]);
    const license = await request(app).get('/api/sessions/license').set('Authorization', `Bearer ${adminToken}`);
    const linha = license.body.data.usuarios.find((u: { id: string }) => u.id === userId);
    expect(linha.status).toBe('offline');
  });

  it('só o proprietário vê o painel de licença (os demais recebem 404)', async () => {
    const login = await request(app).post('/api/auth/login').send({ email, password });
    const denied = await request(app).get('/api/sessions/license').set('Authorization', `Bearer ${login.body.data.accessToken}`);
    expect(denied.status).toBe(404);
  });
});
