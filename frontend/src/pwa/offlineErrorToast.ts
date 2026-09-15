import { OfflineQueuedError } from './OfflineQueuedError.js';

type ShowToast = (message: string, tone?: 'info' | 'success' | 'warning' | 'danger') => void;

/**
 * Toast padrão pra erro de mutação: se foi enfileirado por falta de conexão,
 * avisa "pendente de sincronização" (nunca finge sucesso, seção 26); senão,
 * usa a mensagem de erro real ou o fallback.
 */
export function handleMutationError(err: unknown, showToast: ShowToast, fallback: string) {
  if (err instanceof OfflineQueuedError) {
    showToast(err.message, 'warning');
    return;
  }
  showToast(err instanceof Error ? err.message : fallback, 'danger');
}
