import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { signAccessToken } from '../auth/jwt.js';
import type { Permission } from '../types/auth.types.js';

/** OS_SEND separa "enviar a OS por WhatsApp/e-mail" de "alterar status": o estoque pode só imprimir. */
function tokenFor(permissions: Permission[]): string {
  return signAccessToken({
    sub: randomUUID(),
    email: 'teste@dev.local',
    name: 'Usuário de Teste',
    roleId: randomUUID(),
    roleName: 'Teste',
    permissions,
  });
}

const corpoEnvio = { channel: 'email', type: 'pronta' };
const ID_QUALQUER = randomUUID();

describe('permissão OS_SEND (enviar OS por WhatsApp/e-mail)', () => {
  it('sem OS_SEND o envio responde 403, mesmo com OS_CHANGE_STATUS', async () => {
    const token = tokenFor(['OS_VIEW', 'OS_CHANGE_STATUS']);
    const res = await request(app).post(`/api/os/${ID_QUALQUER}/mensagem`).set('Authorization', `Bearer ${token}`).send(corpoEnvio);
    expect(res.status).toBe(403);
  });

  it('sem OS_SEND revogar a autorização de WhatsApp também responde 403', async () => {
    const token = tokenFor(['OS_VIEW', 'OS_CHANGE_STATUS']);
    const res = await request(app).post(`/api/os/${ID_QUALQUER}/mensagem/revogar-whatsapp`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('com OS_SEND passa da checagem de permissão (falha depois, por a OS não existir)', async () => {
    const token = tokenFor(['OS_VIEW', 'OS_SEND']);
    const res = await request(app).post(`/api/os/${ID_QUALQUER}/mensagem`).set('Authorization', `Bearer ${token}`).send(corpoEnvio);
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
  });

  it('quem só imprime (OS_VIEW) continua vendo a OS', async () => {
    const token = tokenFor(['OS_VIEW']);
    const res = await request(app).get('/api/os').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
