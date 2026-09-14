import type { ReactNode } from 'react';
import styles from './StateMessage.module.css';

interface ErrorStateProps {
  title?: string;
  description?: string;
  action?: ReactNode;
}

/** Mensagem genérica de erro — nunca exibir detalhe técnico (stack, SQL, etc.) ao usuário final. */
export function ErrorState({
  title = 'Algo deu errado',
  description = 'Não foi possível concluir a operação. Tente novamente.',
  action,
}: ErrorStateProps) {
  return (
    <div className={styles.wrapper} role="alert">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: 'var(--color-danger)' }}>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <p className={styles.title}>{title}</p>
      <p className={styles.description}>{description}</p>
      {action}
    </div>
  );
}
