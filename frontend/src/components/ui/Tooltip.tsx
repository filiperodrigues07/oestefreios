import type { ReactNode } from 'react';
import styles from './Tooltip.module.css';

interface TooltipProps {
  content: string;
  children: ReactNode;
}

/** Tooltip somente informativo, visível por foco ou hover; não adiciona ação nova. */
export function Tooltip({ content, children }: TooltipProps) {
  return (
    <span className={styles.wrapper}>
      {children}
      <span className={styles.content} role="tooltip">
        {content}
      </span>
    </span>
  );
}
