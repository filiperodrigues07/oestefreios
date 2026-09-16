import type { ReactNode } from 'react';
import styles from './MetricCard.module.css';

interface MetricCardProps {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  className?: string;
}

/** Bloco de indicador reutilizável. Os valores continuam sendo responsabilidade da página consumidora. */
export function MetricCard({ label, value, detail, className }: MetricCardProps) {
  return (
    <section className={[styles.card, className ?? ''].filter(Boolean).join(' ')} aria-label={label}>
      <span className={styles.label}>{label}</span>
      <strong className={styles.value}>{value}</strong>
      {detail && <span className={styles.detail}>{detail}</span>}
    </section>
  );
}
