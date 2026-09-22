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
let adminName: string;
let adminId: string;

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: env.DEV_ADMIN_EMAIL, password: env.DEV_ADMIN_PASSWORD });
  if (res.status !== 200) {
    throw new Error(`login do seed de dev falhou (rode "npm run db:seed -w backend" antes dos testes): ${res.status}`);
  }
  adminToken = res.body.data.accessToken;
  adminName = res.body.data.user.name;
  adminId = res.body.data.user.id;
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
    expect(entry.userName).toBe(adminName);
    expect(entry.changes.after.problema).toBe('TESTE DE AUDITORIA');
  });

  it('nunca grava senha/token no campo changes', async () => {
    const auditRes = await request(app).get('/api/audit-logs?limit=100').set('Authorization', `Bearer ${adminToken}`);
    const json = JSON.stringify(auditRes.body);
    expect(json).not.toMatch(/passwordHash|"password"|accessToken|refreshToken/i);
  });

  it('combina filtros de evento, categoria, usuário, data e busca', async () => {
    const start = new Date(Date.now() - 60_000).toISOString();
    const end = new Date(Date.now() + 60_000).toISOString();
    const params = new URLSearchParams({ event: 'LOGIN_SUCCESS', categoria: 'AUTH', userId: adminId,
      dataInicial: start, dataFinal: end, busca: adminName });
    const response = await request(app).get(`/api/audit-logs?${params}`).set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    const count = await pool.query<{ count: string }>(
      `SELECT count(*) FROM audit_logs WHERE event = $1 AND user_id = $2
       AND created_at >= $3 AND created_at <= $4 AND user_name ILIKE $5`,
      ['LOGIN_SUCCESS', adminId, start, end, `%${adminName}%`],
    );
    expect(response.body.data.total).toBe(Number(count.rows[0]?.count));
    expect(response.body.data.items.length).toBeGreaterThan(0);
    for (const item of response.body.data.items) {
      expect(item.event).toBe('LOGIN_SUCCESS');
      expect(item.userId).toBe(adminId);
      expect(item.userName).toBe(adminName);
      expect(item).toHaveProperty('userAgent');
    }
  });

  it('exporta Excel sem mudanças brutas', async () => {
    const response = await request(app).get('/api/audit-logs?formato=excel&event=LOGIN_SUCCESS')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('spreadsheetml.sheet');
    expect(response.headers['content-disposition']).toContain('auditoria.xlsx');
    expect(Number(response.headers['content-length'])).toBeGreaterThan(100);
  });

  it('registra criação e edição de cliente e veículo com antes/depois', async () => {
    const clienteInput = { tipoPessoa: 'PF', nome: 'Cliente Auditoria', documento: '12345678901',
      celular: '11999999999', endereco: 'Rua Teste', numero: '1', bairro: 'Centro', cidade: 'São Paulo', uf: 'SP', cep: '01001000' };
    const cliente = await request(app).post('/api/clientes').set('Authorization', `Bearer ${adminToken}`).send(clienteInput);
    expect(cliente.status).toBe(201);
    const codigo = cliente.body.data.codigo as string;
    const editado = await request(app).put(`/api/clientes/${codigo}`).set('Authorization', `Bearer ${adminToken}`)
      .send({ ...clienteInput, nome: 'Cliente Editado' });
    expect(editado.status).toBe(200);
    const veiculo = await request(app).post('/api/equipamentos').set('Authorization', `Bearer ${adminToken}`)
      .send({ clienteCodigo: codigo, placa: 'XYZ9876', marca: 'Volvo' });
    expect(veiculo.status).toBe(201);
    const veiculoCodigo = veiculo.body.data.codigo as string;
    const veiculoEditado = await request(app).put(`/api/equipamentos/${veiculoCodigo}`)
      .set('Authorization', `Bearer ${adminToken}`).send({ clienteCodigo: codigo, placa: 'XYZ9876', marca: 'Scania' });
    expect(veiculoEditado.status).toBe(200);

    const rows = await pool.query<{ event: string; entity_id: string; changes: { before?: { nome?: string; marca?: string }; after?: { nome?: string; marca?: string } } }>(
      'SELECT event, entity_id, changes FROM audit_logs WHERE entity_id IN ($1, $2) AND event IN ($3, $4, $5, $6)',
      [codigo, veiculoCodigo, 'CLIENTE_CREATED', 'CLIENTE_UPDATED', 'VEICULO_CREATED', 'VEICULO_UPDATED']);
    expect(rows.rows.map(row => row.event)).toEqual(expect.arrayContaining(['CLIENTE_CREATED', 'CLIENTE_UPDATED', 'VEICULO_CREATED', 'VEICULO_UPDATED']));
    const updatedClient = rows.rows.find(row => row.event === 'CLIENTE_UPDATED');
    expect(updatedClient?.changes.before?.nome).toBe('CLIENTE AUDITORIA');
    expect(updatedClient?.changes.after?.nome).toBe('CLIENTE EDITADO');
    const updatedVehicle = rows.rows.find(row => row.event === 'VEICULO_UPDATED');
    expect(updatedVehicle?.changes.before?.marca).toBe('VOLVO');
    expect(updatedVehicle?.changes.after?.marca).toBe('SCANIA');
  });

  it('registra configuração geral sem logo bruto', async () => {
    const current = await request(app).get('/api/settings/geral').set('Authorization', `Bearer ${adminToken}`);
    expect(current.status).toBe(200);
    const updated = await request(app).put('/api/settings/geral').set('Authorization', `Bearer ${adminToken}`)
      .send(current.body.data);
    expect(updated.status).toBe(200);
    const audit = await pool.query<{ changes: unknown }>(
      "SELECT changes FROM audit_logs WHERE event = 'SETTINGS_GERAL_UPDATED' ORDER BY created_at DESC LIMIT 1");
    expect(audit.rows[0]?.changes).toBeDefined();
    expect(JSON.stringify(audit.rows[0]?.changes)).not.toContain('logoUrl');
  });

  it('registra SMTP sem senha em changes', async () => {
    const current = await request(app).get('/api/settings/smtp').set('Authorization', `Bearer ${adminToken}`);
    expect(current.status).toBe(200);
    const updated = await request(app).put('/api/settings/smtp').set('Authorization', `Bearer ${adminToken}`)
      .send(current.body.data);
    expect(updated.status).toBe(200);
    const audit = await pool.query<{ changes: unknown }>(
      "SELECT changes FROM audit_logs WHERE event = 'SETTINGS_SMTP_UPDATED' ORDER BY created_at DESC LIMIT 1");
    expect(audit.rows[0]?.changes).toBeDefined();
    expect(JSON.stringify(audit.rows[0]?.changes)).not.toMatch(/"password"|enc:v1:/i);
  });

  it('registra Firebird sem senha em changes', async () => {
    const current = await request(app).get('/api/settings/firebird').set('Authorization', `Bearer ${adminToken}`);
    expect(current.status).toBe(200);
    const updated = await request(app).put('/api/settings/firebird').set('Authorization', `Bearer ${adminToken}`)
      .send(current.body.data);
    expect(updated.status).toBe(200);
    const audit = await pool.query<{ changes: unknown }>(
      "SELECT changes FROM audit_logs WHERE event = 'SETTINGS_FIREBIRD_UPDATED' ORDER BY created_at DESC LIMIT 1");
    expect(audit.rows[0]?.changes).toBeDefined();
    expect(JSON.stringify(audit.rows[0]?.changes)).not.toMatch(/"password"|enc:v1:/i);
  });
});
