import { useAuthStore } from '../store/authStore.js';
import type { ApiResponse } from '../types/cherp.types.js';
import type { LoginResponse } from '../types/auth.types.js';

const API_BASE = '/api';

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
}

/** Cliente HTTP com renovação automática de access token expirado (uma tentativa, sem loop). */
export async function apiFetch<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { accessToken } = useAuthStore.getState();

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

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
