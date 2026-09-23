import { clearOfflineQueue, enqueueOperation } from '../pwa/offlineQueue.js';
import { OfflineQueuedError } from '../pwa/OfflineQueuedError.js';
import { useAuthStore } from '../store/authStore.js';
import type { ApiResponse } from '../types/cherp.types.js';
import type { LoginResponse } from '../types/auth.types.js';

const API_BASE = '/api';
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export class ApiError extends Error {
  code: string;
  status?: number;
  details?: unknown;
  constructor(code: string, message: string, status?: number, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

let refreshInFlight: Promise<boolean> | null = null;

function redirectTo(path: string): void {
  if (typeof window !== 'undefined' && window.location.pathname !== path) {
    window.location.assign(path);
  }
}

function handleRejectedSession(code: string): void {
  if (code === 'PASSWORD_CHANGE_REQUIRED') {
    redirectTo('/alterar-senha');
    return;
  }

  if (code === 'SESSION_REVOKED') {
    useAuthStore.getState().clearSession();
    void clearOfflineQueue().finally(() => redirectTo('/login'));
  }
}

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
  /** Consultas externas pagas nunca devem ser repetidas automaticamente pela fila offline. */
  queueOffline?: boolean;
  /**
   * Texto curto pro usuário, usado só se a mutação precisar ser enfileirada por falta de
   * conexão (seção 26). Sem isso, a fila usa uma descrição genérica "MÉTODO /rota".
   */
  offlineDescription?: string;
}

/** Cliente HTTP com renovação automática de access token expirado (uma tentativa, sem loop). */
export async function apiFetch<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { accessToken } = useAuthStore.getState();
  const { offlineDescription, queueOffline = true, ...requestOptions } = options;
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

    if (isMutation && !isAuthRoute && isOffline && queueOffline) {
      const queueId = await enqueueOperation({
        method: method as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        path,
        body: requestOptions.body,
        description: offlineDescription ?? `${method} ${path}`,
      });
      throw new OfflineQueuedError(queueId);
    }

    if (networkError instanceof Error && networkError.name === 'AbortError') throw networkError;
    throw new ApiError('NETWORK_ERROR', 'Falha de comunicação com o servidor.');
  }

  const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;

  if (res.status === 401 && !isRetry && body && !body.success && body.error.code === 'SESSION_REVOKED') {
    const refreshed = await refreshOnce();
    if (refreshed) return apiFetch<T>(path, options, true);
  }

  if (res.status === 401 && body && !body.success) {
    handleRejectedSession(body.error.code);
  }

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
    const details = body && !body.success ? body.error.details : undefined;
    throw new ApiError(code, message, res.status, details);
  }

  return body.data;
}

/**
 * Baixa um arquivo binário (Excel/PDF de relatórios) — `apiFetch` sempre faz `res.json()`, então
 * não serve pra isso. Mesma renovação de token de `apiFetch`, sem fila offline (download não faz sentido offline).
 */
export async function apiFetchBlob(path: string, isRetry = false): Promise<Blob> {
  const { accessToken } = useAuthStore.getState();
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });

  if (res.status === 401 && !isRetry) {
    const body = (await res.clone().json().catch(() => null)) as ApiResponse<unknown> | null;
    const code = body && !body.success ? body.error.code : '';
    if (code === 'SESSION_REVOKED') {
      const refreshed = await refreshOnce();
      if (refreshed) return apiFetchBlob(path, true);
    }
    handleRejectedSession(code);

    if (code === 'TOKEN_EXPIRED' || !code) {
      const refreshed = await refreshOnce();
      if (refreshed) return apiFetchBlob(path, true);
      useAuthStore.getState().clearSession();
    }
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiResponse<unknown> | null;
    const message = body && !body.success ? body.error.message : 'Não foi possível gerar o arquivo.';
    const code = body && !body.success ? body.error.code : 'NETWORK_ERROR';
    throw new ApiError(code, message, res.status);
  }

  return res.blob();
}

/**
 * Envia `multipart/form-data` (upload de imagem) — `apiFetch` sempre serializa o body como JSON,
 * então não serve pra isso. Sem `Content-Type` manual: o browser define o boundary certo sozinho.
 */
export async function apiFetchMultipart<T>(path: string, formData: FormData, isRetry = false): Promise<T> {
  const { accessToken } = useAuthStore.getState();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    body: formData,
  });

  const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;

  if (res.status === 401 && body && !body.success) {
    handleRejectedSession(body.error.code);
    if (!isRetry && body.error.code === 'TOKEN_EXPIRED') {
      const refreshed = await refreshOnce();
      if (refreshed) return apiFetchMultipart<T>(path, formData, true);
      useAuthStore.getState().clearSession();
    }
  }

  if (!body || !body.success) {
    const code = body && !body.success ? body.error.code : 'NETWORK_ERROR';
    const message = body && !body.success ? body.error.message : 'Falha de comunicação com o servidor.';
    const details = body && !body.success ? body.error.details : undefined;
    throw new ApiError(code, message, res.status, details);
  }

  return body.data;
}

/** Dispara o download do blob no navegador via link temporário — usado pelos exports de relatório. */
export function salvarBlobComoArquivo(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
