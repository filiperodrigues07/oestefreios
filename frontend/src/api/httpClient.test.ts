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

function resposta(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('apiFetch — Idempotency-Key', () => {
  it('POST leva uma chave e ela é reaproveitada na repetição após renovar o token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(resposta(401, { success: false, error: { code: 'TOKEN_EXPIRED', message: 'x' } }))
      .mockResolvedValueOnce(resposta(200, { success: true, data: { accessToken: 't', user: { id: 'u' } } }))
      .mockResolvedValueOnce(resposta(201, { success: true, data: { ok: true } }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/os', { method: 'POST', body: { a: 1 } });

    const chaves = fetchMock.mock.calls
      .filter(([url]) => url === '/api/os')
      .map(([, init]) => new Headers((init as RequestInit).headers).get('Idempotency-Key'));
    expect(chaves).toHaveLength(2);
    expect(chaves[0]).toBeTruthy();
    expect(chaves[1]).toBe(chaves[0]);
  });

  it('GET e rotas /auth não recebem chave', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => resposta(200, { success: true, data: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/os');
    await apiFetch('/auth/logout', { method: 'POST' });

    for (const [, init] of fetchMock.mock.calls) {
      expect(new Headers((init as RequestInit).headers).has('Idempotency-Key')).toBe(false);
    }
  });
});
