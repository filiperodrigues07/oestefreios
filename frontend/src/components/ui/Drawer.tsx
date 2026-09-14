import type { ReactNode } from 'react';
import { useId } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
import styles from './Modal.module.css';

interface DrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Painel lateral — usado para busca/edição rápida sem sair do contexto da tela (ex.: adicionar produto à OS). */
export function Drawer({ open, title, onClose, children }: DrawerProps) {
  const titleId = useId();
  const containerRef = useFocusTrap<HTMLDivElement>(open, onClose);

  if (!open) return null;

  return createPortal(
    <div
      className={styles.overlay}
      style={{ justifyContent: 'flex-end', alignItems: 'stretch', padding: 0 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={containerRef} className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
