import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';
import { usePendingOperations } from '../../hooks/usePendingOperations.js';
import { OPEN_PENDING_OPERATIONS } from '../../pwa/offlineQueue.js';
import styles from './OfflineBanner.module.css';

/**
 * "Você está offline" (seção 25) — visível sempre que a conexão cai, nunca escondido atrás de um toast que some sozinho.
 * Também fica visível enquanto houver alteração pendente ou com falha, mesmo com a conexão de volta: o usuário
 * precisa saber que algo ainda não chegou ao servidor.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const { operations } = usePendingOperations();
  const falhas = operations.filter((op) => op.status === 'failed').length;
  const pendentes = operations.length;

  if (online && pendentes === 0) return null;

  const resumo =
    pendentes === 0
      ? ''
      : ` ${pendentes} alteraç${pendentes > 1 ? 'ões' : 'ão'} aguardando envio${falhas > 0 ? ` (${falhas} com falha)` : ''}.`;

  return (
    <div className={styles.banner} role="status">
      {online ? (
        <>Alterações ainda não enviadas ao servidor.{resumo}</>
      ) : (
        <>
          Você está offline. Dados já abertos podem continuar visíveis; novas consultas precisam de conexão. Alterações
          permitidas ficam pendentes.{resumo}
        </>
      )}
      {pendentes > 0 && (
        <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_PENDING_OPERATIONS))}>
          Ver pendências
        </button>
      )}
    </div>
  );
}
