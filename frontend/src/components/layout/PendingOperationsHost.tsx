import { useEffect, useState } from 'react';
import { usePendingOperations } from '../../hooks/usePendingOperations.js';
import { OPEN_PENDING_OPERATIONS } from '../../pwa/offlineQueue.js';
import { PendingOperationsModal } from './PendingOperationsModal.js';

/** Abre a tela de pendências a partir de qualquer ponto do app (ex.: ação do aviso de falha de sincronização). */
export function PendingOperationsHost() {
  const [aberto, setAberto] = useState(false);
  const { operations } = usePendingOperations();

  useEffect(() => {
    const abrir = () => setAberto(true);
    window.addEventListener(OPEN_PENDING_OPERATIONS, abrir);
    return () => window.removeEventListener(OPEN_PENDING_OPERATIONS, abrir);
  }, []);

  return <PendingOperationsModal open={aberto} operations={operations} onClose={() => setAberto(false)} />;
}
