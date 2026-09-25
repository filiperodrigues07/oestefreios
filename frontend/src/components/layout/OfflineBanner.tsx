import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';
import styles from './OfflineBanner.module.css';

/** "Você está offline" (seção 25) — visível sempre que a conexão cai, nunca escondido atrás de um toast que some sozinho. */
export function OfflineBanner() {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <div className={styles.banner} role="status">
      Você está offline. Dados já abertos podem continuar visíveis; novas consultas precisam de
      conexão. Alterações permitidas ficam pendentes.
    </div>
  );
}
