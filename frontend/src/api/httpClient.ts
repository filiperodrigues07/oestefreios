import { enqueueOperation } from '../pwa/offlineQueue.js';
import { OfflineQueuedError } from '../pwa/OfflineQueuedError.js';
import { useAuthStore } from '../store/authStore.js';
import type { ApiResponse } from '../types/cherp.types.js';
import type { LoginResponse } from '../types/auth.types.js';

const API_BASE = '/api';
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

let refreshInFlight: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
    if (!res.ok) return false;
    const body = (await res.json()) as ApiResponse<LoginResponse>;
    if (!body.success) return false;
    useAuthStore.getState().setSession(body.data.accessToken, body.data.user);
    return true;
  } catch {
    return false;
  }
}

/** Garante que só existe um refresh em voo por vez; chamadas concorrentes esperam o mesmo resultado. */
function refreshOnce(): Promise<boolean> {
  refreshInFlight ??= doRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/**
 * Restaura a sessão ao carregar o app (F5), usando o cookie httpOnly do refresh token
 * — o access token em memória se perde a cada reload, então isso evita exigir novo login.
 */
export function bootstrapSession(): Promise<boolean> {
  return refreshOnce();
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /**
   * Texto curto pro usuário, usado só se a mutação precisar ser enfileirada por falta de
   * conexão (seção 26). Sem isso, a fila usa uma descrição genérica "MÉTODO /rota".
   */
  offlineDescription?: string;
}

/** Cliente HTTP com renovação automática de access token expirado (uma tentativa, sem loop). */
export async function apiFetch<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { accessToken } = useAuthStore.getState();
  const { offlineDescription, ...requestOptions } = options;
  const method = (requestOptions.method ?? 'GET').toUpperCase();

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...requestOptions,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...requestOptions.headers,
      },
      body: requestOptions.body !== undefined ? JSON.stringify(requestOptions.body) : undefined,
    });
  } catch (networkError) {
    const isMutation = MUTATING_METHODS.has(method);
    const isAuthRoute = path.startsWith('/auth');
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (isMutation && !isAuthRoute && isOffline) {
      const queueId = await enqueueOperation({
        method: method as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        path,
        body: requestOptions.body,
        description: offlineDescription ?? `${method} ${path}`,
      });
      throw new OfflineQueuedError(queueId);
    }

    throw networkError;
  }

  const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;

  if (res.status === 401 && !isRetry && body && !body.success && body.error.code === 'TOKEN_EXPIRED') {
    const refreshed = await refreshOnce();
    if (refreshed) {
      return apiFetch<T>(path, options, true);
    }
    useAuthStore.getState().clearSession();
  }

  if (!body || !body.success) {
    const code = body && !body.success ? body.error.code : 'NETWORK_ERROR';
    const message = body && !body.success ? body.error.message : 'Falha de comunicação com o servidor.';
    throw new ApiError(code, message);
  }

  return body.data;
}
