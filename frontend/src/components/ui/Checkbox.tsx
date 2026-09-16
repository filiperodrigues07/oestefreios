import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import styles from './Checkbox.module.css';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  /** Estado intermediário (ex.: "alguns itens do grupo marcados") — não nativo em HTML, via prop. */
  indeterminate?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, indeterminate, id, className, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <label htmlFor={inputId} className={[styles.wrapper, className ?? ''].filter(Boolean).join(' ')}>
      <input
        ref={(node) => {
          if (node) node.indeterminate = Boolean(indeterminate);
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        id={inputId}
        type="checkbox"
        className={styles.input}
        {...rest}
      />
      <span className={styles.label}>{label}</span>
    </label>
  );
});
