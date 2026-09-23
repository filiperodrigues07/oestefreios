import styles from './ResultsSummary.module.css';

interface ResultsSummaryProps {
  total?: number;
}

/** Total filtrado da lista, visualmente ligado à tabela ou aos cards abaixo. */
export function ResultsSummary({ total }: ResultsSummaryProps) {
  return (
    <div className={styles.summary} role="status" aria-live="polite">
      <span className={styles.label}>Resultados</span>
      <span className={styles.count}>
        {total === undefined ? 'Carregando…' : (
          <><strong>{total.toLocaleString('pt-BR')}</strong> {total === 1 ? 'registro' : 'registros'}</>
        )}
      </span>
    </div>
  );
}
