import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { apiFetch } from '../api/httpClient.js';
import { useToast } from '../components/ui/ToastProvider.js';
import { getAllOperations, markOperationFailed, removeOperation } from '../pwa/offlineQueue.js';

/**
 * Ao reconectar, tenta sincronizar a fila de mutações pendentes (seção 26).
 * Nunca finge sucesso: cada item vira um toast dizendo se sincronizou ou falhou,
 * e falhas ficam guardadas na fila (não desaparecem silenciosamente).
 */
export function useOfflineSync() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    async function flush() {
      const pending = await getAllOperations();
      if (pending.length === 0) return;

      let sincronizadas = 0;
      let falhas = 0;

      for (const op of pending) {
        try {
          await apiFetch(op.path, { method: op.method, body: op.body });
          await removeOperation(op.id);
          sincronizadas++;
        } catch {
          await markOperationFailed(op.id);
          falhas++;
        }
      }

      if (sincronizadas > 0) {
        showToast(
          `${sincronizadas} alteração${sincronizadas > 1 ? 'ões' : ''} pendente${sincronizadas > 1 ? 's' : ''} sincronizada${sincronizadas > 1 ? 's' : ''} com o servidor.`,
          'success',
        );
        await queryClient.invalidateQueries();
      }
      if (falhas > 0) {
        showToast(
          `${falhas} alteração${falhas > 1 ? 'ões' : ''} não pôde${falhas > 1 ? 'ram' : ''} ser sincronizada${falhas > 1 ? 's' : ''}. Revise e tente de novo.`,
          'danger',
        );
      }
    }

    window.addEventListener('online', flush);
    // também tenta uma vez ao montar, caso já esteja online com fila pendente de uma sessão anterior
    if (navigator.onLine) flush();

    return () => window.removeEventListener('online', flush);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
