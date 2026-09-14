import type { OSHistoricoEntry } from '../../types/os.types.js';
import styles from './HistoryTimeline.module.css';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** Linha do tempo da OS (seção 15 do briefing). Mais recente por último, como registrado. */
export function HistoryTimeline({ entries }: { entries: OSHistoricoEntry[] }) {
  return (
    <ol className={styles.timeline}>
      {entries.map((entry, index) => (
        <li key={index} className={styles.entry}>
          <span className={styles.time}>{formatTime(entry.timestamp)}</span>
          <div className={styles.content}>
            <span className={styles.evento}>{entry.evento}</span>
            <span className={styles.usuario}>{entry.usuarioNome}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
