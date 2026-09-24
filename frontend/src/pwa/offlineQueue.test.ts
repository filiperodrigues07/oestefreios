import { describe, expect, it } from 'vitest';
import { operationBelongsToUser, type PendingOperation } from './offlineQueue.js';

const operation: PendingOperation = {
  id: 1,
  method: 'PUT',
  path: '/os/123',
  body: { prioridade: 'ALTA' },
  description: 'Atualizar OS',
  createdAt: '2026-09-24T00:00:00.000Z',
  status: 'pending',
  ownerUserId: 'usuario-a',
};

describe('propriedade da fila offline', () => {
  it('permite sincronizar apenas para o usuário que criou a operação', () => {
    expect(operationBelongsToUser(operation, 'usuario-a')).toBe(true);
    expect(operationBelongsToUser(operation, 'usuario-b')).toBe(false);
    expect(operationBelongsToUser(operation, '')).toBe(false);
  });

  it('não reenvia operações legadas sem identificação de usuário', () => {
    expect(operationBelongsToUser({ ...operation, ownerUserId: undefined }, 'usuario-a')).toBe(
      false,
    );
  });
});
