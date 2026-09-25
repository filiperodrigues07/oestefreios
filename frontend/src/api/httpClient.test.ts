import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './httpClient.js';

function resposta(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('apiFetch — Idempotency-Key', () => {
  afterEach(() => vi.unstubAllGlobals());

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
