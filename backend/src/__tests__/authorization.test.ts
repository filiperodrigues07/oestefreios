import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { signAccessToken } from '../auth/jwt.js';
import type { Permission } from '../types/auth.types.js';

/**
 * Testes de autorização (seção 61 do briefing: "Permissões são verificadas no backend",
 * "Operacional não consegue acessar endpoint financeiro"). Assina tokens diretamente com
 * conjuntos de permissão controlados — não depende de login real nem do Postgres, então
 * roda isolado e rápido, testando exatamente a checagem de permissão em si.
 */
function tokenFor(permissions: Permission[], overrides: Partial<{ roleName: string }> = {}): string {
  return signAccessToken({
    sub: randomUUID(),
    email: 'teste@dev.local',
    name: 'Usuário de Teste',
    roleId: randomUUID(),
    roleName: overrides.roleName ?? 'Teste',
    permissions,
  });
}

const MECANICO_PERMISSIONS: Permission[] = [
  'OS_VIEW',
  'OS_CHANGE_STATUS',
  'CLIENT_DELETE',
  'VEHICLE_DELETE',
  'PRODUCT_VIEW',
  'PRODUCT_SEARCH',
  'PRODUCT_ADD_TO_OS',
  'SERVICE_VIEW',
  'SERVICE_SEARCH',
  'SERVICE_ADD_TO_OS',
];

const ADMIN_PERMISSIONS: Permission[] = [
  'OS_VIEW',
  'OS_CREATE',
  'OS_EDIT',
  'OS_DELETE',
  'OS_CHANGE_STATUS',
  'PRODUCT_VIEW',
  'PRODUCT_SEARCH',
  'PRODUCT_ADD_TO_OS',
  'SERVICE_VIEW',
  'SERVICE_SEARCH',
  'SERVICE_ADD_TO_OS',
  'FINANCIAL_VIEW',
  'FINANCIAL_EDIT',
  'USER_VIEW',
  'USER_CREATE',
  'USER_EDIT',
  'USER_DELETE',
  'REPORT_VIEW',
  'SYSTEM_SETTINGS',
];

describe('autorização: sem token', () => {
  it.each([
    ['GET', '/api/produtos'],
    ['GET', '/api/os'],
    ['POST', '/api/os'],
    ['GET', '/api/dashboard/admin'],
    ['GET', '/api/dashboard/me'],
    ['GET', '/api/audit-logs'],
  ])('%s %s responde 401 sem Authorization', async (method, path) => {
    const res = await request(app)[method.toLowerCase() as 'get' | 'post'](path);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('autorização: perfil Mecânico (permissões limitadas)', () => {
  const token = tokenFor(MECANICO_PERMISSIONS, { roleName: 'Mecânico' });

  it('GET /api/os funciona (tem OS_VIEW)', async () => {
    const res = await request(app).get('/api/os').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('POST /api/os responde 403 (sem OS_CREATE)', async () => {
    const res = await request(app)
      .post('/api/os')
      .set('Authorization', `Bearer ${token}`)
      .send({ clienteCodigo: '000001', equipamentoCodigo: 'EQ01', problema: 'teste', prioridade: 'NORMAL' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('GET /api/dashboard/admin responde 403 (sem REPORT_VIEW)', async () => {
    const res = await request(app).get('/api/dashboard/admin').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('GET /api/dashboard/me funciona (é sempre a própria sessão, sem permissão extra)', async () => {
    const res = await request(app).get('/api/dashboard/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('GET /api/audit-logs responde 403 (sem SYSTEM_SETTINGS)', async () => {
    const res = await request(app).get('/api/audit-logs').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('regra crítica: GET /api/produtos nunca inclui precoUnitario/custo pro Mecânico', async () => {
    const res = await request(app).get('/api/produtos?codigo=00012345').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const json = JSON.stringify(res.body);
    expect(json).not.toContain('precoUnitario');
    expect(json).not.toContain('custo');
  });
});

describe('autorização: perfil Administrador (todas as permissões)', () => {
  const token = tokenFor(ADMIN_PERMISSIONS, { roleName: 'Administrador' });

  it('GET /api/dashboard/admin funciona e traz financeiro', async () => {
    const res = await request(app).get('/api/dashboard/admin').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.financeiro).toBeDefined();
  });

  it('GET /api/audit-logs funciona (tem SYSTEM_SETTINGS)', async () => {
    const res = await request(app).get('/api/audit-logs').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('GET /api/produtos inclui precoUnitario (tem FINANCIAL_VIEW)', async () => {
    const res = await request(app).get('/api/produtos?codigo=00012345').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).toContain('precoUnitario');
  });
});

describe('autorização: token malformado ou expirado', () => {
  it('token com assinatura inválida responde 401', async () => {
    const res = await request(app).get('/api/os').set('Authorization', 'Bearer token.invalido.aqui');
    expect(res.status).toBe(401);
  });

  it('header sem "Bearer " responde 401', async () => {
    const token = tokenFor(ADMIN_PERMISSIONS);
    const res = await request(app).get('/api/os').set('Authorization', token);
    expect(res.status).toBe(401);
  });
});
