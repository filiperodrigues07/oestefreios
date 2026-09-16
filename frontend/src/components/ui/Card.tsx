import type { ButtonHTMLAttributes, HTMLAttributes } from 'react';
import styles from './Card.module.css';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
}

export function Card({ elevated, className, ...rest }: CardProps) {
  const classes = [styles.card, elevated ? styles.elevated : '', className ?? ''].filter(Boolean).join(' ');
  return <div className={classes} {...rest} />;
}

interface CardButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  elevated?: boolean;
}

/** Card clicável (ex.: item de lista abrindo detalhe) — semântica de botão, não div com onClick. */
export function CardButton({ elevated, className, ...rest }: CardButtonProps) {
  const classes = [styles.card, styles.interactive, elevated ? styles.elevated : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      className={classes}
      {...rest}
    />
  );
}
