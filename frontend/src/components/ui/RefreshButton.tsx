import { Button } from './Button.js';
import styles from './RefreshButton.module.css';

interface RefreshButtonProps {
  onClick: () => void;
  loading?: boolean;
  label?: string;
}

/** Botão de atualizar (item 9 da rodada de melhorias) — reusa refetch() do React Query, ícone gira durante o carregamento. */
export function RefreshButton({ onClick, loading, label = 'Atualizar' }: RefreshButtonProps) {
  return (
    <Button size="sm" variant="secondary" onClick={onClick} disabled={loading}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <svg
          className={`${styles.icon} ${loading ? styles.spinning : ''}`}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {label}
      </span>
    </Button>
  );
}
