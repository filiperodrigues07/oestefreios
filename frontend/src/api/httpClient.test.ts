import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './httpClient.js';
import { useAuthStore } from '../store/authStore.js';

afterEach(() => {
  useAuthStore.getState().clearSession();
  vi.unstubAllGlobals();
});

describe('reenvio de alteração offline', () => {
  it('não envia uma operação pertencente a outra conta', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    useAuthStore.getState().setSession('token-b', {
      id: 'usuario-b',
      name: 'Usuário B',
      email: 'b@exemplo.com',
      photoUrl: null,
      roleId: 'role-b',
      roleName: 'Técnico',
      permissions: ['OS_EDIT'],
      mustChangePassword: false,
      isSuperAdmin: false,
    });

    await expect(
      apiFetch('/os/123', {
        method: 'PUT',
        body: { prioridade: 'ALTA' },
        expectedUserId: 'usuario-a',
      }),
    ).rejects.toMatchObject({ code: 'OFFLINE_OWNER_CHANGED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
