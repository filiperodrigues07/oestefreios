import styles from './BarList.module.css';

export interface BarListItem {
  label: string;
  value: number;
  /** Token CSS de cor (ex. "var(--color-success)"). Default: série categórica única (regra do skill —
   * nominal ranking sem identidade própria usa um só tom, nunca um por barra). */
  color?: string;
}

interface BarListProps {
  items: BarListItem[];
  emptyLabel?: string;
  formatValue?: (value: number) => string;
}

/** Lista de barras horizontais — usada tanto pra ranking (1 cor) quanto por categoria com identidade própria (cor por item). */
export function BarList({ items, emptyLabel = 'Sem dados ainda.', formatValue }: BarListProps) {
  if (items.length === 0) {
    return <p className={styles.empty}>{emptyLabel}</p>;
  }

  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className={styles.chart}>
      {items.map((item) => (
        <div className={styles.row} key={item.label}>
          <span className={styles.rowLabel} title={item.label}>
            {item.label}
          </span>
          <div className={styles.track}>
            <div
              className={styles.bar}
              style={{ width: `${Math.max((item.value / max) * 100, 2)}%`, background: item.color ?? 'var(--chart-series-1)' }}
            />
          </div>
          <span className={styles.rowValue}>{formatValue ? formatValue(item.value) : item.value}</span>
        </div>
      ))}
    </div>
  );
}
