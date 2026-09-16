import { forwardRef, useId, useState, type InputHTMLAttributes } from 'react';
import inputStyles from './Input.module.css';
import styles from './PasswordInput.module.css';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
}

/** Campo de senha com botão de mostrar/ocultar — usado nas telas de Configurações e login. */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { label, error, id, className, ...rest },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className={inputStyles.field}>
      {label && (
        <label htmlFor={inputId} className={inputStyles.label}>
          {label}
        </label>
      )}
      <div className={styles.inputWrapper}>
        <input
          ref={ref}
          id={inputId}
          type={visible ? 'text' : 'password'}
          className={[inputStyles.input, styles.input, error ? inputStyles.inputError : '', className ?? '']
            .filter(Boolean)
            .join(' ')}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          {...rest}
        />
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          tabIndex={-1}
        >
          {visible ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M6.6 6.6C4.3 8.1 2.7 10 2 12c1.5 3.9 5.5 7 10 7 1.6 0 3.1-.4 4.4-1M17.4 17.4C19.7 15.9 21.3 14 22 12c-.8-2.1-2.3-4-4.2-5.4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M2 12c1.5-3.9 5.5-7 10-7s8.5 3.1 10 7c-1.5 3.9-5.5 7-10 7s-8.5-3.1-10-7Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          )}
        </button>
      </div>
      {error && (
        <span id={errorId} role="alert" className={inputStyles.errorText}>
          {error}
        </span>
      )}
    </div>
  );
});
