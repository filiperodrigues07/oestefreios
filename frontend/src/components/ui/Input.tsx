import { forwardRef, useId, type ChangeEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import styles from './Input.module.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  error?: string;
  /** Converte o valor digitado pra maiúsculas antes de repassar ao onChange — padrão do CHERP pra nome/endereço/placa etc. */
  uppercase?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id, className, uppercase, onChange, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = error ? `${inputId}-error` : undefined;

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if (uppercase) {
      const pos = e.target.selectionStart;
      e.target.value = e.target.value.toLocaleUpperCase('pt-BR');
      if (pos !== null) e.target.setSelectionRange(pos, pos);
    }
    onChange?.(e);
  }

  return (
    <div className={styles.field}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={[styles.input, error ? styles.inputError : '', className ?? ''].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        onChange={uppercase ? handleChange : onChange}
        // Campo em maiúsculas: teclado do celular já abre em CAPS e o corretor não "corrige" nome/placa.
        autoCapitalize={uppercase ? 'characters' : undefined}
        spellCheck={uppercase ? false : undefined}
        {...rest}
      />
      {error && (
        <span id={errorId} role="alert" className={styles.errorText}>
          {error}
        </span>
      )}
    </div>
  );
});
