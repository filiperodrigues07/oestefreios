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
      {activeCount > 0 && onClear && (
        <button type="button" className={styles.clear} onClick={onClear}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
          Limpar filtros
        </button>
      )}
    </div>
  );
}
