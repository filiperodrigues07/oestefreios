import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../auth/password.js';
import { app } from '../app.js';
import { pool } from '../database/postgres/client.js';
import { soltarBilling, travarBilling } from './billingLock.js';
import { aplicarControleManual, hojeIso, statusParaCliente } from '../services/billing.service.js';

const senha = 'Teste@123456';

interface Conta {
  id: string;
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
  return { id, token: login.body.data.accessToken };
}

const emDias = (dias: number) => {
  const d = new Date(`${hojeIso()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

describe('aplicarControleManual (regra pura)', () => {
  const vencida = { estado: 'SOMENTE_LEITURA' as const, diasParaVencer: -20 };
  const emDia = { estado: 'EM_DIA' as const, diasParaVencer: 10 };

  it('AUTO respeita a data', () => {
    expect(aplicarControleManual(vencida, { modo: 'AUTO', liberadoAte: null }, '2026-09-24')).toMatchObject({ estado: 'SOMENTE_LEITURA', origem: 'DATA' });
  });

  it('SUSPENSO trava mesmo em dia', () => {
    expect(aplicarControleManual(emDia, { modo: 'SUSPENSO', liberadoAte: null }, '2026-09-24')).toMatchObject({ estado: 'SOMENTE_LEITURA', origem: 'MANUAL' });
  });

  it('LIBERADO vale sem prazo e até a data; depois volta ao automático', () => {
    expect(aplicarControleManual(vencida, { modo: 'LIBERADO', liberadoAte: null }, '2026-09-24')).toMatchObject({ estado: 'EM_DIA', origem: 'MANUAL' });
    expect(aplicarControleManual(vencida, { modo: 'LIBERADO', liberadoAte: '2026-09-24' }, '2026-09-24')).toMatchObject({ estado: 'EM_DIA', origem: 'MANUAL' });
    expect(aplicarControleManual(vencida, { modo: 'LIBERADO', liberadoAte: '2026-09-23' }, '2026-09-24')).toMatchObject({ estado: 'SOMENTE_LEITURA', origem: 'DATA' });
  });
});

describe('statusParaCliente', () => {
  it('o cliente só enxerga o modo consulta; avisos de vencimento e origem ficam com o proprietário', () => {
    const base = { diasParaVencer: 3, origem: 'DATA' as const };
    expect(statusParaCliente({ ...base, estado: 'A_VENCER', mensagem: 'vence em 3 dia(s)' })).toEqual({ estado: 'EM_DIA', diasParaVencer: null, mensagem: '' });
    expect(statusParaCliente({ ...base, estado: 'VENCIDA', mensagem: 'x' })).toEqual({ estado: 'EM_DIA', diasParaVencer: null, mensagem: '' });
    expect(statusParaCliente({ diasParaVencer: -9, origem: 'MANUAL', estado: 'SOMENTE_LEITURA', mensagem: 'Fale com o suporte' })).toEqual({
      estado: 'SOMENTE_LEITURA',
      diasParaVencer: null,
      mensagem: 'Fale com o suporte',
    });
  });
});

describe('controle do proprietário (API)', () => {
  let dono: Conta;
  let adminDoCliente: Conta;
  let mecanico: Conta;
  let billingOriginal: unknown = null;
  let licencaOriginal: unknown = null;
  const auth = (c: Conta) => ({ Authorization: `Bearer ${c.token}` });
  const base = { cliente: 'Teste', plano: 'Mensal', valorMensal: 300, diaVencimento: 10, carenciaDias: 5, avisoDias: 7 };

  beforeAll(async () => {
    await travarBilling();
    billingOriginal = (await pool.query("SELECT data FROM settings WHERE category = 'billing'")).rows[0]?.data ?? null;
    licencaOriginal = (await pool.query("SELECT data FROM settings WHERE category = 'licenca'")).rows[0]?.data ?? null;
    dono = await criarConta('dono2', 'Administrador', ['SYSTEM_SETTINGS', 'OS_VIEW', 'OS_CREATE', 'OS_EDIT'], true);
    adminDoCliente = await criarConta('admin2', 'Administrador', ['SYSTEM_SETTINGS', 'OS_VIEW', 'OS_CREATE', 'OS_EDIT'], false);
    mecanico = await criarConta('mecanico2', 'Mecânico', ['OS_VIEW'], false);
  });

  afterAll(async () => {
    await soltarBilling();
    if (billingOriginal) await pool.query("UPDATE settings SET data = $1 WHERE category = 'billing'", [billingOriginal]);
    else await pool.query("DELETE FROM settings WHERE category = 'billing'");
    if (licencaOriginal) await pool.query("UPDATE settings SET data = $1 WHERE category = 'licenca'", [licencaOriginal]);
    else await pool.query("DELETE FROM settings WHERE category = 'licenca'");
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [[dono.id, adminDoCliente.id, mecanico.id]]);
    await pool.end();
  });

  it('suspender exige motivo, trava os demais na hora com a mensagem do proprietário e não trava ele', async () => {
    await request(app).put('/api/billing').set(auth(dono)).send({ ...base, vencimentoAtual: emDias(30) });

    const semMotivo = await request(app).post('/api/billing/controle').set(auth(dono)).send({ acao: 'SUSPENDER', motivo: 'ab' });
    expect(semMotivo.status).toBe(400);

    const suspenso = await request(app).post('/api/billing/controle').set(auth(dono)).send({ acao: 'SUSPENDER', motivo: 'atraso confirmado', mensagemCliente: 'Regularize com a Rodrigues Tech.' });
    expect(suspenso.status).toBe(200);
    expect(suspenso.body.data).toMatchObject({ estado: 'SOMENTE_LEITURA', origem: 'MANUAL', modo: 'SUSPENSO' });

    const bloqueado = await request(app).post('/api/clientes').set(auth(adminDoCliente)).send({});
    expect(bloqueado.status).toBe(403);
    expect(bloqueado.body.error.code).toBe('SUBSCRIPTION_READ_ONLY');
    expect(bloqueado.body.error.message).toBe('Regularize com a Rodrigues Tech.');

    const statusMecanico = await request(app).get('/api/billing/status').set(auth(mecanico));
    expect(statusMecanico.body.data).toEqual({ estado: 'SOMENTE_LEITURA', diasParaVencer: null, mensagem: 'Regularize com a Rodrigues Tech.' });

    const livre = await request(app).post('/api/clientes').set(auth(dono)).send({});
    expect(livre.body.error?.code).not.toBe('SUBSCRIPTION_READ_ONLY');
  });

  it('liberar até uma data destrava mesmo vencido; voltar ao automático devolve o cálculo por data', async () => {
    await request(app).put('/api/billing').set(auth(dono)).send({ ...base, vencimentoAtual: '2020-01-10' });
    const liberado = await request(app).post('/api/billing/controle').set(auth(dono)).send({ acao: 'LIBERAR', motivo: 'pagou fora do prazo', liberadoAte: emDias(3) });
    expect(liberado.body.data).toMatchObject({ estado: 'EM_DIA', origem: 'MANUAL', modo: 'LIBERADO' });
    const livre = await request(app).post('/api/clientes').set(auth(adminDoCliente)).send({});
    expect(livre.body.error?.code).not.toBe('SUBSCRIPTION_READ_ONLY');

    const auto = await request(app).post('/api/billing/controle').set(auth(dono)).send({ acao: 'AUTOMATICO', motivo: 'voltando ao normal' });
    expect(auto.body.data).toMatchObject({ estado: 'SOMENTE_LEITURA', origem: 'DATA', modo: 'AUTO' });
    await request(app).put('/api/billing').set(auth(dono)).send({ ...base, vencimentoAtual: null });
  });

  it('aviso de vencimento é do proprietário: o cliente vê em dia', async () => {
    await request(app).put('/api/billing').set(auth(dono)).send({ ...base, vencimentoAtual: emDias(3) });
    const doDono = await request(app).get('/api/billing/status').set(auth(dono));
    expect(doDono.body.data).toMatchObject({ estado: 'A_VENCER', origem: 'DATA' });
    const doCliente = await request(app).get('/api/billing/status').set(auth(adminDoCliente));
    expect(doCliente.body.data).toEqual({ estado: 'EM_DIA', diasParaVencer: null, mensagem: '' });
  });

  it('controle e licença: 404 para quem não é proprietário', async () => {
    expect((await request(app).post('/api/billing/controle').set(auth(adminDoCliente)).send({ acao: 'SUSPENDER', motivo: 'tentativa' })).status).toBe(404);
    expect((await request(app).get('/api/superadmin/licenca').set(auth(adminDoCliente))).status).toBe(404);
    expect((await request(app).put('/api/superadmin/licenca').set(auth(mecanico)).send({ limite: 1, idleMinutes: 10, sessaoUnica: true })).status).toBe(404);
  });

  it('limite de licenças: valida, salva no painel e informa a origem', async () => {
    const invalido = await request(app).put('/api/superadmin/licenca').set(auth(dono)).send({ limite: 9999, idleMinutes: 0, sessaoUnica: true });
    expect(invalido.status).toBe(400);

    // limite 0 (sem limite) + sessão única desligada = mesmo comportamento do ambiente de teste, seguro em paralelo.
    const salvo = await request(app).put('/api/superadmin/licenca').set(auth(dono)).send({ limite: 0, idleMinutes: 30, sessaoUnica: false });
    expect(salvo.status).toBe(200);
    expect(salvo.body.data).toMatchObject({ limite: 0, idleMinutes: 30, sessaoUnica: false, origem: { limite: 'painel', idleMinutes: 'painel', sessaoUnica: 'painel' } });

    const lido = await request(app).get('/api/superadmin/licenca').set(auth(dono));
    expect(lido.body.data).toMatchObject({ idleMinutes: 30 });
    const resumo = await request(app).get('/api/sessions/license').set(auth(dono));
    expect(resumo.body.data.idleMinutes).toBe(30);
  });

  it('auditoria: eventos do proprietário ficam ocultos para o Administrador do cliente', async () => {
    const doDono = await request(app).get('/api/audit-logs?limit=100').set(auth(dono));
    expect(JSON.stringify(doDono.body)).toMatch(/BILLING_CONTROL|LICENSE_UPDATED/);
    const doCliente = await request(app).get('/api/audit-logs?limit=100').set(auth(adminDoCliente));
    expect(doCliente.status).toBe(200);
    expect(JSON.stringify(doCliente.body)).not.toMatch(/BILLING_|LICENSE_UPDATED/);
  });
});
