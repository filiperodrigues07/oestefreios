import { useAuthStore } from '../store/authStore.js';
import { APP_VERSION } from './appVersion.js';

type Source = 'boundary' | 'route' | 'window' | 'promise';

const enviados = new Set<string>();
const MAX_POR_SESSAO = 20;

/**
 * Manda o erro de tela pro log do backend (POST /api/client-errors). Nunca lança nem trava a UI:
 * falha de rede aqui é ignorada. Mesmo erro só é enviado uma vez por sessão da aba.
 */
export function reportClientError(source: Source, error: unknown, componentStack?: string): void {
  try {
    const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : JSON.stringify(error));
    const chave = `${source}:${err.message}`;
    if (enviados.has(chave) || enviados.size >= MAX_POR_SESSAO) return;
    enviados.add(chave);

    const payload = {
      source,
      message: err.message || String(error),
      stack: err.stack,
      componentStack,
      url: window.location.pathname + window.location.search,
      version: APP_VERSION,
      userId: useAuthStore.getState().user?.id,
    };
    void fetch('/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Relatório de erro nunca pode gerar outro erro.
  }
}

/** Erros fora do React (script, evento, promise sem catch). Chamado uma vez no main.tsx. */
export function installGlobalErrorReporting(): void {
  window.addEventListener('error', (event) => {
    // Aviso benigno do navegador, não é bug do app.
    if (/ResizeObserver loop/i.test(event.message)) return;
    reportClientError('window', event.error ?? event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    // Falha de rede/sessão já tem tratamento e toast próprios — não é bug de tela.
    const reason = event.reason as { code?: unknown; name?: unknown } | undefined;
    if (reason && (reason.code === 'NETWORK_ERROR' || reason.name === 'OfflineQueuedError' || reason.name === 'AbortError')) return;
    reportClientError('promise', event.reason);
  });
}
