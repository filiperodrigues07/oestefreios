import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { env } from '../config/env.js';
import { pool } from '../database/postgres/client.js';

/**
 * Auditoria de negócio (seção 24): ação de OS grava no Postgres e aparece via GET
 * /api/audit-logs. Precisa de um usuário de verdade (login real com o seed de dev),
 * não um token assinado à mão — audit_logs.user_id tem FK pra users.id, então um
 * "sub" fabricado quebraria a restrição (é o schema fazendo o trabalho dele).
 */

let adminToken: string;

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: env.DEV_ADMIN_EMAIL, password: env.DEV_ADMIN_PASSWORD });
  if (res.status !== 200) {
    throw new Error(`login do seed de dev falhou (rode "npm run db:seed -w backend" antes dos testes): ${res.status}`);
  }
  adminToken = res.body.data.accessToken;
});

afterAll(async () => {
  await pool.end();
});

describe('auditoria de negócio', () => {
  it('criar OS grava um evento OS_CREATED consultável em GET /api/audit-logs', async () => {
    const createRes = await request(app)
      .post('/api/os')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ clienteCodigo: '000001', equipamentoCodigo: 'EQ01', problema: 'Teste de auditoria', prioridade: 'NORMAL' });
    expect(createRes.status).toBe(201);
    const osId = createRes.body.data.id as string;

    const auditRes = await request(app)
      .get('/api/audit-logs?event=OS_CREATED&limit=50')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(auditRes.status).toBe(200);

    const entry = auditRes.body.data.items.find((item: { entityId: string }) => item.entityId === osId);
    expect(entry).toBeDefined();
    expect(entry.entityType).toBe('OS');
    expect(entry.userName).toBe('Admin (dev)');
    expect(entry.changes.after.problema).toBe('Teste de auditoria');
  });

  it('nunca grava senha/token no campo changes', async () => {
    const auditRes = await request(app).get('/api/audit-logs?limit=100').set('Authorization', `Bearer ${adminToken}`);
    const json = JSON.stringify(auditRes.body);
    expect(json).not.toMatch(/passwordHash|"password"|accessToken|refreshToken/i);
  });
});
