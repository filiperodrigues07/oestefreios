import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../auth/password.js';
import { app } from '../app.js';
import { env } from '../config/env.js';
import { pool } from '../database/postgres/client.js';
import { calcularEstadoAssinatura, proximoVencimento } from '../services/billing.service.js';

const base = { carenciaDias: 5, avisoDias: 7 };

describe('calcularEstadoAssinatura', () => {
  it('sem vencimento = em dia', () => {
    expect(calcularEstadoAssinatura({ vencimento: null, hoje: '2026-09-23', ...base })).toEqual({ estado: 'EM_DIA', diasParaVencer: null });
  });

  it('percorre em dia, a vencer, vencida e somente leitura', () => {
    const estado = (venc: string) => calcularEstadoAssinatura({ vencimento: venc, hoje: '2026-09-23', ...base }).estado;
    expect(estado('2026-10-01')).toBe('EM_DIA');
    expect(estado('2026-09-30')).toBe('A_VENCER');
    expect(estado('2026-09-23')).toBe('A_VENCER');
    expect(estado('2026-09-22')).toBe('VENCIDA');
    expect(estado('2026-09-18')).toBe('VENCIDA');
    expect(estado('2026-09-17')).toBe('SOMENTE_LEITURA');
  });
});

describe('proximoVencimento', () => {
  it('soma um mês respeitando o dia e o fim de mês', () => {
    expect(proximoVencimento('2026-09-10', 10)).toBe('2026-10-10');
    expect(proximoVencimento('2026-12-10', 10)).toBe('2027-01-10');
    expect(proximoVencimento('2026-01-31', 31)).toBe('2026-02-28');
    expect(proximoVencimento('2028-01-31', 31)).toBe('2028-02-29');
  });
});

describe('API de mensalidade', () => {
  const userId = randomUUID();
  const email = `billing-${userId}@test.local`;
  const password = 'Teste@123456';
  let adminToken: string;
  let userToken: string;
  let original: unknown = null;

  async function salvar(vencimentoAtual: string | null) {
    return request(app).put('/api/billing').set('Authorization', `Bearer ${adminToken}`).send({
      cliente: 'Teste', plano: 'Mensal', valorMensal: 300, vencimentoAtual, diaVencimento: 10, carenciaDias: 5, avisoDias: 7,
    });
  }

  beforeAll(async () => {
    const antes = await pool.query("SELECT data FROM settings WHERE category = 'billing'");
    original = antes.rows[0]?.data ?? null;
    const role = await pool.query<{ id: string }>("SELECT id FROM roles WHERE name = 'Mecânico'");
    await pool.query('INSERT INTO users (id, name, email, password_hash, role_id) VALUES ($1, $2, $3, $4, $5)', [
      userId, 'Teste Billing', email, await hashPassword(password), role.rows[0]?.id,
    ]);
    const admin = await request(app).post('/api/auth/login').send({ email: env.DEV_ADMIN_EMAIL, password: env.DEV_ADMIN_PASSWORD });
    adminToken = admin.body.data.accessToken;
    const user = await request(app).post('/api/auth/login').send({ email, password });
    userToken = user.body.data.accessToken;
  });

  afterAll(async () => {
    if (original) await pool.query("UPDATE settings SET data = $1 WHERE category = 'billing'", [original]);
    else await pool.query("DELETE FROM settings WHERE category = 'billing'");
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await pool.end();
  });

  it('só SYSTEM_SETTINGS lê e edita; status é aberto a qualquer logado e não expõe valores', async () => {
    expect((await request(app).get('/api/billing').set('Authorization', `Bearer ${userToken}`)).status).toBe(404);
    expect((await request(app).put('/api/billing').set('Authorization', `Bearer ${userToken}`).send({})).status).toBe(404);
    const status = await request(app).get('/api/billing/status').set('Authorization', `Bearer ${userToken}`);
    expect(status.status).toBe(200);
    expect(Object.keys(status.body.data).sort()).toEqual(['diasParaVencer', 'estado', 'mensagem']);
  });

  it('registrar pagamento avança o vencimento em um mês e guarda o histórico', async () => {
    await salvar('2026-09-10');
    const res = await request(app).post('/api/billing/pagamentos').set('Authorization', `Bearer ${adminToken}`).send({
      data: '2026-09-09', referencia: '2026-09', valor: 300, forma: 'PIX', observacao: 'comprovante 123',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.vencimentoAtual).toBe('2026-10-10');
    expect(res.body.data.pagamentos).toHaveLength(1);

    const remove = await request(app).delete(`/api/billing/pagamentos/${res.body.data.pagamentos[0].id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(remove.status).toBe(200);
    expect(remove.body.data.pagamentos).toHaveLength(0);
  });

  it('somente leitura: usuário comum lê mas não escreve; admin segue livre', async () => {
    const ok = await salvar('2020-01-10');
    expect(ok.body.data.estado).toBe('SOMENTE_LEITURA');

    const leitura = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${userToken}`);
    expect(leitura.status).toBe(200);
    const escrita = await request(app).post('/api/clientes').set('Authorization', `Bearer ${userToken}`).send({});
    expect(escrita.body).toMatchObject({ error: { code: 'SUBSCRIPTION_READ_ONLY' } });
    expect(escrita.status).toBe(403);
    expect(escrita.body.error.code).toBe('SUBSCRIPTION_READ_ONLY');

    const admin = await request(app).post('/api/billing/pagamentos').set('Authorization', `Bearer ${adminToken}`).send({
      data: '2026-09-09', referencia: '2026-09', valor: 300, forma: 'PIX', observacao: '',
    });
    expect(admin.status).toBe(200);

    await salvar(null);
    const liberado = await request(app).post('/api/clientes').set('Authorization', `Bearer ${userToken}`).send({});
    expect(liberado.body.error?.code).not.toBe('SUBSCRIPTION_READ_ONLY');
  });
});
