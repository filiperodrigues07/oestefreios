import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import styles from './Tooltip.module.css';

interface TooltipProps {
  content: string;
  children: ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrapperRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeEscape);
    };
  }, [open]);

  return (
    <span
      ref={wrapperRef}
      className={`${styles.wrapper} ${open ? styles.open : ''}`}
      tabIndex={0}
      aria-describedby={id}
      onPointerDown={(event) => {
        if (event.pointerType === 'touch') setOpen((current) => !current);
      }}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          setOpen((current) => !current);
        }
      }}
    >
      {children}
      <span id={id} className={styles.content} role="tooltip">
        {content}
      </span>
    </span>
  );
}
