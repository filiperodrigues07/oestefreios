import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../auth/password.js';
import { app } from '../app.js';
import { env } from '../config/env.js';
import { pool } from '../database/postgres/client.js';

const senha = 'Teste@123456';

interface Conta {
  id: string;
  email: string;
  token: string;
}

async function criarConta(nome: string, perfil: string, permissoes: string[], superAdmin: boolean): Promise<Conta> {
  const id = randomUUID();
  const email = `${nome}-${id}@test.local`;
  const role = await pool.query<{ id: string }>('SELECT id FROM roles WHERE name = $1', [perfil]);
  await pool.query('INSERT INTO users (id, name, email, password_hash, role_id, is_super_admin) VALUES ($1, $2, $3, $4, $5, $6)', [
    id, `Teste ${nome}`, email, await hashPassword(senha), role.rows[0]?.id, superAdmin,
  ]);
  if (permissoes.length > 0) {
    await pool.query('INSERT INTO user_permissions (user_id, permission_id) SELECT $1, id FROM permissions WHERE code = ANY($2)', [id, permissoes]);
  }
  const login = await request(app).post('/api/auth/login').send({ email, password: senha });
  return { id, email, token: login.body.data.accessToken };
}

describe('super admin (proprietário)', () => {
  let dono: Conta;
  let adminDoCliente: Conta;
  let gerente: Conta;
  let billingOriginal: unknown = null;
  const auth = (conta: Conta) => ({ Authorization: `Bearer ${conta.token}` });
  const todas = ['SYSTEM_SETTINGS', 'USER_VIEW', 'USER_EDIT', 'USER_DELETE', 'USER_CREATE', 'OS_VIEW', 'OS_CREATE', 'OS_EDIT'];

  beforeAll(async () => {
    const antes = await pool.query("SELECT data FROM settings WHERE category = 'billing'");
    billingOriginal = antes.rows[0]?.data ?? null;
    dono = await criarConta('dono', 'Administrador', todas, true);
    adminDoCliente = await criarConta('admincliente', 'Administrador', todas, false);
    gerente = await criarConta('gerente', 'Gerente', ['USER_VIEW', 'USER_EDIT', 'USER_DELETE', 'OS_VIEW', 'OS_CREATE'], false);
  });

  afterAll(async () => {
    if (billingOriginal) await pool.query("UPDATE settings SET data = $1 WHERE category = 'billing'", [billingOriginal]);
    else await pool.query("DELETE FROM settings WHERE category = 'billing'");
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [[dono.id, adminDoCliente.id, gerente.id]]);
    await pool.end();
  });

  it('login informa isSuperAdmin só para quem é proprietário', async () => {
    const donoLogin = await request(app).post('/api/auth/login').send({ email: dono.email, password: senha });
    const clienteLogin = await request(app).post('/api/auth/login').send({ email: adminDoCliente.email, password: senha });
    expect(donoLogin.body.data.user.isSuperAdmin).toBe(true);
    expect(clienteLogin.body.data.user.isSuperAdmin).toBe(false);
  });

  it('assinatura, sessões e licença: proprietário passa; Administrador do cliente e Gerente recebem 404', async () => {
    for (const rota of ['/api/billing', '/api/sessions', '/api/sessions/license']) {
      expect((await request(app).get(rota).set(auth(dono))).status).toBe(200);
      expect((await request(app).get(rota).set(auth(adminDoCliente))).status).toBe(404);
      expect((await request(app).get(rota).set(auth(gerente))).status).toBe(404);
    }
    const edicao = await request(app).put('/api/billing').set(auth(adminDoCliente)).send({});
    expect(edicao.status).toBe(404);
  });

  it('o status resumido do banner continua aberto a qualquer usuário logado', async () => {
    const status = await request(app).get('/api/billing/status').set(auth(gerente));
    expect(status.status).toBe(200);
  });

  it('somente leitura: só o proprietário escreve; Administrador do cliente é bloqueado como qualquer um', async () => {
    const salvar = await request(app).put('/api/billing').set(auth(dono)).send({
      cliente: 'Teste', plano: 'Mensal', valorMensal: 300, vencimentoAtual: '2020-01-10', diaVencimento: 10, carenciaDias: 5, avisoDias: 7,
    });
    expect(salvar.body.data.estado).toBe('SOMENTE_LEITURA');

    const bloqueado = await request(app).post('/api/clientes').set(auth(adminDoCliente)).send({});
    expect(bloqueado.status).toBe(403);
    expect(bloqueado.body.error.code).toBe('SUBSCRIPTION_READ_ONLY');

    const livre = await request(app).post('/api/clientes').set(auth(dono)).send({});
    expect(livre.body.error?.code).not.toBe('SUBSCRIPTION_READ_ONLY');

    await request(app).put('/api/billing').set(auth(dono)).send({
      cliente: 'Teste', plano: 'Mensal', valorMensal: 300, vencimentoAtual: null, diaVencimento: 10, carenciaDias: 5, avisoDias: 7,
    });
  });

  it('o proprietário é invisível e intocável para os demais (404), mas aparece para ele mesmo', async () => {
    const listaGerente = await request(app).get('/api/usuarios').set(auth(gerente));
    expect(listaGerente.status).toBe(200);
    expect(listaGerente.body.data.some((u: { id: string }) => u.id === dono.id)).toBe(false);

    const listaAdminCliente = await request(app).get('/api/usuarios').set(auth(adminDoCliente));
    expect(listaAdminCliente.body.data.some((u: { id: string }) => u.id === dono.id)).toBe(false);

    const listaDono = await request(app).get('/api/usuarios').set(auth(dono));
    expect(listaDono.body.data.some((u: { id: string }) => u.id === dono.id)).toBe(true);

    expect((await request(app).get(`/api/usuarios/${dono.id}`).set(auth(gerente))).status).toBe(404);
    expect((await request(app).put(`/api/usuarios/${dono.id}`).set(auth(gerente)).send({ name: 'Invasor' })).status).toBe(404);
    expect((await request(app).delete(`/api/usuarios/${dono.id}`).set(auth(gerente))).status).toBe(404);
    expect((await request(app).post(`/api/usuarios/${dono.id}/reenviar-convite`).set(auth(gerente))).status).toBe(404);
    const aindaExiste = await pool.query('SELECT name FROM users WHERE id = $1', [dono.id]);
    expect(aindaExiste.rows[0]?.name).toBe('Teste dono');
  });

  it('a API de usuários nunca devolve nem aceita a flag de proprietário', async () => {
    const lista = await request(app).get('/api/usuarios').set(auth(dono));
    expect(JSON.stringify(lista.body)).not.toMatch(/isSuperAdmin|is_super_admin/);
    const tentativa = await request(app).put(`/api/usuarios/${gerente.id}`).set(auth(dono)).send({ isSuperAdmin: true });
    expect([200, 400]).toContain(tentativa.status);
    const linha = await pool.query('SELECT is_super_admin FROM users WHERE id = $1', [gerente.id]);
    expect(linha.rows[0]?.is_super_admin).toBe(false);
  });

  it('revogar a flag vale na hora, sem esperar o token expirar', async () => {
    expect((await request(app).get('/api/billing').set(auth(dono))).status).toBe(200);
    await pool.query('UPDATE users SET is_super_admin = false WHERE id = $1', [dono.id]);
    expect((await request(app).get('/api/billing').set(auth(dono))).status).toBe(404);
    await pool.query('UPDATE users SET is_super_admin = true WHERE id = $1', [dono.id]);
    expect((await request(app).get('/api/billing').set(auth(dono))).status).toBe(200);
  });

  it('o admin de desenvolvimento do seed é proprietário', async () => {
    const admin = await request(app).post('/api/auth/login').send({ email: env.DEV_ADMIN_EMAIL, password: env.DEV_ADMIN_PASSWORD });
    expect(admin.body.data.user.isSuperAdmin).toBe(true);
  });
});
