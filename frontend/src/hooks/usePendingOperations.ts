import { useCallback, useEffect, useState } from 'react';
import { OFFLINE_QUEUE_CHANGED, getAllOperations, operationBelongsToUser, type PendingOperation } from '../pwa/offlineQueue.js';
import { useAuthStore } from '../store/authStore.js';

/** Operações offline do usuário logado (pendentes e com falha), atualizadas sempre que a fila muda. */
export function usePendingOperations(): { operations: PendingOperation[]; reload: () => void } {
  const userId = useAuthStore((s) => s.user?.id);
  const [operations, setOperations] = useState<PendingOperation[]>([]);

  const reload = useCallback(() => {
    Promise.resolve(userId ? getAllOperations() : [])
      .then((all) => setOperations(all.filter((op) => userId !== undefined && operationBelongsToUser(op, userId))))
      .catch(() => setOperations([]));
  }, [userId]);

  useEffect(() => {
    reload();
    window.addEventListener(OFFLINE_QUEUE_CHANGED, reload);
    return () => window.removeEventListener(OFFLINE_QUEUE_CHANGED, reload);
  }, [reload]);

  return { operations, reload };
}
