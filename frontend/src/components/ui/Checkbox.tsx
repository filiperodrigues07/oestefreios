import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import styles from './Checkbox.module.css';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  /** Estado intermediário (ex.: "alguns itens do grupo marcados") — não nativo em HTML, via prop. */
  indeterminate?: boolean;
  /** Explicação curta embaixo do rótulo — lida pelo leitor de tela como descrição do campo. */
  hint?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, indeterminate, hint, id, className, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;

  return (
    <label htmlFor={inputId} className={[styles.wrapper, hint ? styles.comHint : '', className ?? ''].filter(Boolean).join(' ')}>
      <input
        ref={(node) => {
          if (node) node.indeterminate = Boolean(indeterminate);
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        id={inputId}
        type="checkbox"
        className={styles.input}
        aria-describedby={hint ? hintId : rest['aria-describedby']}
        {...rest}
      />
      <span className={styles.texto}>
        <span className={styles.label}>{label}</span>
        {hint && <span id={hintId} className={styles.hint}>{hint}</span>}
      </span>
    </label>
  );
});
