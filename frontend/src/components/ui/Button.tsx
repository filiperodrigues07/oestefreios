import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'destructive';

function buttonClasses(
  variant: Variant,
  size: 'sm' | 'md',
  fullWidth: boolean | undefined,
  className: string | undefined,
) {
  return [styles.button, styles[variant], size === 'sm' ? styles.sm : '', fullWidth ? styles.fullWidth : '', className ?? '']
    .filter(Boolean)
    .join(' ');
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', fullWidth, loading, disabled, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={buttonClasses(variant, size, fullWidth, className)}
      disabled={disabled || loading}
      aria-busy={loading}
      {...rest}
    >
      {children}
    </button>
  );
});

interface LinkButtonProps extends LinkProps {
  variant?: Variant;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
}

/** Mesma aparência do Button, mas navega via react-router — nunca aninhar <button> dentro de <a>. */
export function LinkButton({ variant = 'primary', size = 'md', fullWidth, className, ...rest }: LinkButtonProps) {
  return <Link className={buttonClasses(variant, size, fullWidth, className)} {...rest} />;
}
