import { Link } from 'react-router';
import styles from './EditButton.module.css';

interface EditButtonProps {
  to: string;
  label: string;
}

/** Ícone de lápis — ação "editar" nas listas (OS, Clientes), sempre na mesma coluna/posição. */
export function EditButton({ to, label }: EditButtonProps) {
  return (
    <Link to={to} className={styles.button} aria-label={label} title={label} onClick={(e) => e.stopPropagation()}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}
