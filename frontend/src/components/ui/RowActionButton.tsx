import { ActionIcon } from './ActionIcon.js';
import styles from './EditButton.module.css';

interface RowActionButtonProps {
  icon: 'copy' | 'delete';
  label: string;
  onClick: () => void;
  tone?: 'danger';
}

/** Botão-ícone de ação de linha (duplicar, excluir) — mesma medida/posição do lápis e da impressora. */
export function RowActionButton({ icon, label, onClick, tone }: RowActionButtonProps) {
  return (
    <button
      type="button"
      className={tone === 'danger' ? `${styles.button} ${styles.danger}` : styles.button}
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <ActionIcon name={icon} />
    </button>
  );
}
