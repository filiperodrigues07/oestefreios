import { useState } from 'react';
import styles from './EditButton.module.css';

interface PrintButtonProps {
  label: string;
  onImprimir: () => Promise<void>;
}

/** Ícone de impressora — mesma posição/estilo do lápis de editar, baixa o PDF da OS. */
export function PrintButton({ label, onImprimir }: PrintButtonProps) {
  const [carregando, setCarregando] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (carregando) return;
    setCarregando(true);
    try {
      await onImprimir();
    } finally {
      setCarregando(false);
    }
  }

  return (
    <button
      type="button"
      className={styles.button}
      aria-label={label}
      title={label}
      onClick={handleClick}
      disabled={carregando}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-2M6 14h12v7H6z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
