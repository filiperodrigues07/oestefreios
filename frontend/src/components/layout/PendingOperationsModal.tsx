import { useState } from 'react';
import { useNavigate } from 'react-router';
import { OFFLINE_QUEUE_CHANGED, removeOperation, retryOperation, type PendingOperation } from '../../pwa/offlineQueue.js';
import { Badge } from '../ui/Badge.js';
import { Button } from '../ui/Button.js';
import { ConfirmDialog } from '../ui/ConfirmDialog.js';
import { Modal } from '../ui/Modal.js';
import styles from './PendingOperationsModal.module.css';

interface PendingOperationsModalProps {
  open: boolean;
  operations: PendingOperation[];
  onClose: () => void;
}

/** Alterações de OS têm o id da OS no caminho (`/os/<id>/...`): dá pra levar o usuário direto pra ela. */
function osDoCaminho(path: string): string | undefined {
  return /^\/os\/([0-9a-fA-F-]{36})(?:\/|$)/.exec(path)?.[1];
}

function notificar() {
  window.dispatchEvent(new Event(OFFLINE_QUEUE_CHANGED));
}

/** Alterações feitas offline que ainda não chegaram ao servidor — o usuário revisa, reenvia ou descarta. */
export function PendingOperationsModal({ open, operations, onClose }: PendingOperationsModalProps) {
  const navigate = useNavigate();
  async function reenviar(op: PendingOperation) {
    await retryOperation(op.id);
    notificar();
    // O hook de sincronização escuta 'online' e reenvia tudo que estiver pendente.
    window.dispatchEvent(new Event('online'));
  }

  const [paraDescartar, setParaDescartar] = useState<PendingOperation | null>(null);

  async function descartar(op: PendingOperation) {
    await removeOperation(op.id);
    notificar();
    setParaDescartar(null);
  }

  return (
    <Modal open={open} title="Alterações pendentes" onClose={onClose}>
      {operations.length === 0 ? (
        <p className={styles.empty}>Nenhuma alteração pendente.</p>
      ) : (
        <ul className={styles.list}>
          {operations.map((op) => (
            <li key={op.id} className={styles.item}>
              <div className={styles.text}>
                <div className={styles.description}>{op.description}</div>
                <div className={styles.meta}>
                  {new Date(op.createdAt).toLocaleString('pt-BR')}
                  {op.lastError ? ` — ${op.lastError}` : ''}
                </div>
              </div>
              <Badge tone={op.status === 'failed' ? 'danger' : 'warning'}>
                {op.status === 'failed' ? 'Falhou' : 'Aguardando conexão'}
              </Badge>
              <div className={styles.actions}>
                {osDoCaminho(op.path) && (
                  <Button size="sm" variant="secondary" onClick={() => { onClose(); navigate(`/os/${osDoCaminho(op.path)}`); }}>
                    Abrir OS
                  </Button>
                )}
                {op.status === 'failed' && (
                  <Button size="sm" variant="secondary" onClick={() => void reenviar(op)}>
                    Tentar de novo
                  </Button>
                )}
                <Button size="sm" variant="danger" onClick={() => setParaDescartar(op)}>
                  Descartar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={paraDescartar !== null}
        title="Descartar alteração?"
        description={`"${paraDescartar?.description ?? ''}" não será enviada ao servidor e não poderá ser recuperada.`}
        confirmLabel="Descartar"
        danger
        onConfirm={() => paraDescartar && void descartar(paraDescartar)}
        onCancel={() => setParaDescartar(null)}
      />
    </Modal>
  );
}
