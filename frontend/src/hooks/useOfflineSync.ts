import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { ApiError, apiFetch } from '../api/httpClient.js';
import { useToast } from '../components/ui/ToastProvider.js';
import {
  OFFLINE_QUEUE_CHANGED,
  getAllOperations,
  markOperationFailed,
  operationBelongsToUser,
  removeOperation,
} from '../pwa/offlineQueue.js';
import { useAuthStore } from '../store/authStore.js';

/**
 * Ao reconectar, tenta sincronizar a fila de mutações pendentes (seção 26).
 * Nunca finge sucesso: cada item vira um toast dizendo se sincronizou ou falhou,
 * e falhas ficam guardadas na fila (não desaparecem silenciosamente).
 */
export function useOfflineSync() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);
  const flushingUsersRef = useRef(new Set<string>());

  useEffect(() => {
    async function flush() {
      if (!userId || flushingUsersRef.current.has(userId)) return;
      flushingUsersRef.current.add(userId);
      try {
        const pending = await getAllOperations();
        if (pending.length === 0) return;

        let sincronizadas = 0;
        let falhas = 0;
        let antigas = 0;

        for (const op of pending) {
          if (useAuthStore.getState().user?.id !== userId) break;
          if (!op.ownerUserId) {
            antigas++;
            continue;
          }
          if (!operationBelongsToUser(op, userId)) continue;
          // Já falhou por erro do servidor (4xx): só reenvia quando o usuário pedir na tela de pendências.
          if (op.status === 'failed') continue;
          try {
            await apiFetch(op.path, {
              method: op.method,
              body: op.body,
              queueOffline: false,
              expectedUserId: userId,
              headers: op.idempotencyKey ? { 'Idempotency-Key': op.idempotencyKey } : undefined,
            });
            await removeOperation(op.id);
            sincronizadas++;
          } catch (error) {
            // Sem rede ou servidor instável: a operação continua pendente e a próxima reconexão tenta de novo.
            // Só erro definitivo (4xx) vira "falhou" — reenviar às cegas duplicaria ou repetiria um erro.
            const definitivo = error instanceof ApiError && error.status !== undefined && error.status >= 400 && error.status < 500 && error.status !== 401 && error.status !== 429;
            if (!definitivo) break;
            await markOperationFailed(op.id, error.message);
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
        if (antigas > 0) {
          showToast(
            `${antigas} alteração${antigas > 1 ? 'ões' : ''} offline antiga${antigas > 1 ? 's' : ''} não pode${antigas > 1 ? 'm' : ''} ser sincronizada${antigas > 1 ? 's' : ''} com segurança. Confira os dados no servidor e refaça a alteração, se necessário.`,
            'warning',
          );
        }
      } finally {
        window.dispatchEvent(new Event(OFFLINE_QUEUE_CHANGED));
        flushingUsersRef.current.delete(userId);
      }
    }

    const triggerFlush = () => {
      void flush().catch(() =>
        showToast('Não foi possível ler a fila offline. Tente novamente ao reconectar.', 'danger'),
      );
    };
    window.addEventListener('online', triggerFlush);
    // Só tenta depois da autenticação; um registro de outra conta nunca é reenviado.
    if (navigator.onLine && userId) triggerFlush();

    return () => window.removeEventListener('online', triggerFlush);
  }, [userId, queryClient, showToast]);
}
