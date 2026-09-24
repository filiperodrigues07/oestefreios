import { forwardRef, useId, useState, type InputHTMLAttributes } from 'react';
import inputStyles from './Input.module.css';
import styles from './PasswordInput.module.css';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  /** Carrega um segredo mascarado apenas quando o usuário pede para visualizá-lo. */
  onReveal?: () => Promise<string>;
  /** Mostra o botão de copiar (usa o valor digitado ou, se o segredo está mascarado, busca via onReveal). */
  copyable?: boolean;
}

async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = texto;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

/** Campo de senha com botão de mostrar/ocultar — usado nas telas de Configurações e login. */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { label, error, id, className, onReveal, copyable, onChange, value, ...rest },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = error ? `${inputId}-error` : undefined;

  async function handleCopy() {
    let texto = typeof value === 'string' ? value : '';
    if (!texto && onReveal) {
      setRevealing(true);
      try {
        texto = await onReveal();
      } catch {
        texto = '';
      } finally {
        setRevealing(false);
      }
    }
    const ok = texto ? await copiarTexto(texto) : false;
    setCopyState(ok ? 'copied' : 'failed');
    window.setTimeout(() => setCopyState('idle'), 2000);
  }

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
          className={[inputStyles.input, styles.input, copyable ? styles.withCopy : '', error ? inputStyles.inputError : '', className ?? '']
            .filter(Boolean)
            .join(' ')}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          value={value}
          onChange={onChange}
          {...rest}
        />
        {copyable && (
          <button
            type="button"
            className={`${styles.toggle} ${styles.copy}`}
            onClick={handleCopy}
            aria-label={label ? `Copiar ${label.toLowerCase()}` : 'Copiar'}
            title="Copiar"
            disabled={revealing}
          >
            {copyState === 'copied' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12l4 4L19 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
                <path d="M5 15V6a2 2 0 0 1 2-2h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            )}
          </button>
        )}
        <button
          type="button"
          className={styles.toggle}
          onClick={async () => {
            if (!visible && onReveal && !value) {
              setRevealing(true);
              try {
                await onReveal();
              } finally {
                setRevealing(false);
              }
            }
            setVisible((v) => !v);
          }}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visible}
          disabled={revealing}
        >
          {revealing ? '…' : visible ? (
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
      <span role="status" className={styles.srOnly}>
        {copyState === 'copied' ? 'Copiado para a área de transferência.' : copyState === 'failed' ? 'Não foi possível copiar.' : ''}
      </span>
      {error && (
        <span id={errorId} role="alert" className={inputStyles.errorText}>
          {error}
        </span>
      )}
    </div>
  );
});
