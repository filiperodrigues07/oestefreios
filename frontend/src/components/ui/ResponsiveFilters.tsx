import { useState, type ReactNode } from 'react';
import styles from './ResponsiveFilters.module.css';

interface ResponsiveFiltersProps {
  children: ReactNode;
  activeCount?: number;
  onClear?: () => void;
}

export function ResponsiveFilters({ children, activeCount = 0, onClear }: ResponsiveFiltersProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`${styles.group} ${open ? styles.open : ''}`}>
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span>Filtros{activeCount > 0 ? ` (${activeCount})` : ''}</span>
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      <div className={styles.content}>{children}</div>
      {open && activeCount > 0 && onClear && (
        <button type="button" className={styles.clear} onClick={onClear}>
          Limpar filtros
        </button>
      )}
    </div>
  );
}
