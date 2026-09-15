import styles from './StatTile.module.css';

interface StatTileProps {
  label: string;
  value: string;
}

/** Contrato: label em sentence case sem dois-pontos, valor já formatado (compacto) pelo chamador. */
export function StatTile({ label, value }: StatTileProps) {
  return (
    <div className={styles.tile}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
    </div>
  );
}
