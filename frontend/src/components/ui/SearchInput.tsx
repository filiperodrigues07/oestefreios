import { forwardRef, type InputHTMLAttributes } from 'react';
import { Input } from './Input.js';
import styles from './SearchInput.module.css';

type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: string;
  error?: string;
};

/** Campo de busca visual; mantém a mesma semântica e props do Input nativo. */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput({ className, label, ...props }, ref) {
  return (
    <div className={`${styles.wrapper} ${label ? styles.withLabel : ''}`}>
      <svg className={styles.icon} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.8" />
        <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <Input ref={ref} label={label} type="search" className={[styles.input, className ?? ''].filter(Boolean).join(' ')} {...props} />
    </div>
  );
});
