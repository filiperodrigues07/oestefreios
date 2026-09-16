import type { ReactNode } from 'react';
import styles from './Badge.module.css';

export type BadgeTone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = 'neutral', children, className }: BadgeProps) {
  return <span className={[styles.badge, styles[tone], className].filter(Boolean).join(' ')}>{children}</span>;
}
