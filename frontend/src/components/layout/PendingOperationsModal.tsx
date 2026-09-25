import { OFFLINE_QUEUE_CHANGED, removeOperation, retryOperation, type PendingOperation } from '../../pwa/offlineQueue.js';
import { Badge } from '../ui/Badge.js';
import { Button } from '../ui/Button.js';
import { Modal } from '../ui/Modal.js';
import styles from './PendingOperationsModal.module.css';

interface PendingOperationsModalProps {
  open: boolean;
  operations: PendingOperation[];
  onClose: () => void;
}

function notificar() {
  window.dispatchEvent(new Event(OFFLINE_QUEUE_CHANGED));
}

/** Alterações feitas offline que ainda não chegaram ao servidor — o usuário revisa, reenvia ou descarta. */
export function PendingOperationsModal({ open, operations, onClose }: PendingOperationsModalProps) {
  async function reenviar(op: PendingOperation) {
    await retryOperation(op.id);
    notificar();
    // O hook de sincronização escuta 'online' e reenvia tudo que estiver pendente.
    window.dispatchEvent(new Event('online'));
  }

  async function descartar(op: PendingOperation) {
    await removeOperation(op.id);
    notificar();
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
                {op.status === 'failed' && (
                  <Button size="sm" variant="secondary" onClick={() => void reenviar(op)}>
                    Tentar de novo
                  </Button>
                )}
                <Button size="sm" variant="danger" onClick={() => void descartar(op)}>
                  Descartar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
