import { OfflineQueuedError } from './OfflineQueuedError.js';
import { getUserErrorMessage } from '../utils/errorPresentation.js';

type ShowToast = (message: string, tone?: 'info' | 'success' | 'warning' | 'danger') => void;

/**
 * Toast padrão pra erro de mutação: se foi enfileirado por falta de conexão,
 * avisa "pendente de sincronização" (nunca finge sucesso, seção 26); senão,
 * usa uma mensagem segura para a tela.
 */
export function handleMutationError(err: unknown, showToast: ShowToast, fallback: string) {
  if (err instanceof OfflineQueuedError) {
    showToast(err.message, 'warning');
    return;
  }
  showToast(getUserErrorMessage(err, fallback), 'danger');
}
