import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../auth/password.js';
import { app } from '../app.js';
import { env } from '../config/env.js';
import { pool } from '../database/postgres/client.js';
import { descreverVinculos, temVinculos } from '../utils/vinculos.js';

const cliente = (documento: string, nome: string) => ({
  tipoPessoa: 'PF',
  nome,
  documento,
  celular: '(11) 99999-0000',
  endereco: 'Rua A',
  numero: '1',
  bairro: 'Centro',
  cidade: 'Sao Paulo',
  uf: 'SP',
  cep: '01001000',
});

describe('vínculos (regra pura)', () => {
  const vazio = { os: 0, veiculos: 0, financeiro: 0, fiscal: 0, pedidos: 0, outros: 0 };

  it('detecta qualquer vínculo', () => {
    expect(temVinculos(vazio)).toBe(false);
    expect(temVinculos({ ...vazio, financeiro: 1 })).toBe(true);
  });

  it('descreve só o que existe', () => {
    const texto = descreverVinculos({ ...vazio, os: 3, veiculos: 2 }, 'cliente');
    expect(texto).toContain('3 OS');
    expect(texto).toContain('2 veículo(s)');
    expect(texto).not.toContain('financeiros');
  });
});

describe('excluir cliente e veículo (API, modo mock)', () => {
  const userId = randomUUID();
  const email = `exclusao-${userId}@test.local`;
  const password = 'Teste@123456';
  let adminToken: string;
  let userToken: string;
  const inicio = new Date();
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const role = await pool.query<{ id: string }>("SELECT id FROM roles WHERE name = 'Mecânico'");
    await pool.query('INSERT INTO users (id, name, email, password_hash, role_id) VALUES ($1, $2, $3, $4, $5)', [
      userId, 'Teste Exclusão', email, await hashPassword(password), role.rows[0]?.id,
    ]);
    const admin = await request(app).post('/api/auth/login').send({ email: env.DEV_ADMIN_EMAIL, password: env.DEV_ADMIN_PASSWORD });
    adminToken = admin.body.data.accessToken;
    const user = await request(app).post('/api/auth/login').send({ email, password });
    userToken = user.body.data.accessToken;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await pool.end();
  });

  it('sem token 401; sem permissão 403; motivo curto 400', async () => {
    expect((await request(app).delete('/api/clientes/000003').send({ motivo: 'motivo valido' })).status).toBe(401);
    expect((await request(app).delete('/api/clientes/000003').set(auth(userToken)).send({ motivo: 'motivo valido' })).status).toBe(403);
    expect((await request(app).delete('/api/equipamentos/EQ03').set(auth(userToken)).send({ motivo: 'motivo valido' })).status).toBe(403);
    const curto = await request(app).delete('/api/clientes/000003').set(auth(adminToken)).send({ motivo: 'ab' });
    expect(curto.status).toBe(400);
  });

  it('bloqueia cliente com OS/veículos e veículo com OS (409, nada é excluído)', async () => {
    const cli = await request(app).delete('/api/clientes/000001').set(auth(adminToken)).send({ motivo: 'cadastro duplicado' });
    expect(cli.status).toBe(409);
    expect(cli.body.error.code).toBe('CLIENT_HAS_LINKS');
    expect(cli.body.error.details.os).toBeGreaterThan(0);
    expect((await request(app).get('/api/clientes/000001').set(auth(adminToken))).status).toBe(200);

    const veic = await request(app).delete('/api/equipamentos/EQ01').set(auth(adminToken)).send({ motivo: 'cadastro duplicado' });
    expect(veic.status).toBe(409);
    expect(veic.body.error.code).toBe('VEHICLE_HAS_LINKS');
    expect((await request(app).get('/api/equipamentos/EQ01').set(auth(adminToken))).status).toBe(200);
  });

  it('exclui veículo e cliente sem vínculos, audita com motivo e não deixa editar depois', async () => {
    const criadoCli = await request(app).post('/api/clientes').set(auth(adminToken)).send(cliente('529.982.247-25', 'cliente teste exclusao'));
    expect(criadoCli.status).toBe(201);
    const codigoCli = criadoCli.body.data.codigo as string;

    const criadoVeic = await request(app).post('/api/equipamentos').set(auth(adminToken)).send({ clienteCodigo: codigoCli, placa: 'ZZZ-9A99', marca: 'teste' });
    expect(criadoVeic.status).toBe(201);
    const codigoVeic = criadoVeic.body.data.codigo as string;

    // Cliente com veículo ativo bloqueia.
    const bloqueado = await request(app).delete(`/api/clientes/${codigoCli}`).set(auth(adminToken)).send({ motivo: 'teste de exclusão' });
    expect(bloqueado.status).toBe(409);
    expect(bloqueado.body.error.details.veiculos).toBe(1);

    const veic = await request(app).delete(`/api/equipamentos/${codigoVeic}`).set(auth(adminToken)).send({ motivo: 'teste de exclusão' });
    expect(veic.status).toBe(200);
    expect((await request(app).get(`/api/equipamentos/${codigoVeic}`).set(auth(adminToken))).status).toBe(404);

    const cli = await request(app).delete(`/api/clientes/${codigoCli}`).set(auth(adminToken)).send({ motivo: 'teste de exclusão' });
    expect(cli.status).toBe(200);
    expect((await request(app).get(`/api/clientes/${codigoCli}`).set(auth(adminToken))).status).toBe(404);

    // Cadastro excluído não pode ser "revivido" por uma edição atrasada.
    const edicao = await request(app).put(`/api/clientes/${codigoCli}`).set(auth(adminToken)).send(cliente('529.982.247-25', 'cliente teste exclusao'));
    expect(edicao.status).toBe(404);

    // Segunda exclusão do mesmo cadastro: 404, sem erro 500.
    expect((await request(app).delete(`/api/clientes/${codigoCli}`).set(auth(adminToken)).send({ motivo: 'teste de exclusão' })).status).toBe(404);

    const audit = await pool.query<{ event: string; changes: { motivo?: string } }>(
      "SELECT event, changes FROM audit_logs WHERE entity_id = ANY($1) AND event IN ('CLIENTE_DELETED','VEICULO_DELETED') AND created_at >= $2",
      [[codigoCli, codigoVeic], inicio],
    );
    expect(audit.rows.map((row) => row.event).sort()).toEqual(['CLIENTE_DELETED', 'VEICULO_DELETED']);
    expect(audit.rows.every((row) => row.changes.motivo === 'teste de exclusão')).toBe(true);
  });
});
