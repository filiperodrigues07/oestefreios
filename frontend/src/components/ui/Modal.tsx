import type { ReactNode } from 'react';
import { useId } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
import { ActionIcon } from './ActionIcon.js';
import styles from './Modal.module.css';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  centerOnMobile?: boolean;
}

export function Modal({ open, title, onClose, children, footer, centerOnMobile = false }: ModalProps) {
  const titleId = useId();
  const containerRef = useFocusTrap<HTMLDivElement>(open, onClose);

  if (!open) return null;

  return createPortal(
    <div
      className={`${styles.overlay} ${centerOnMobile ? styles.centerOnMobile : ''}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={containerRef} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Fechar">
            <ActionIcon name="close" size={16} />
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
