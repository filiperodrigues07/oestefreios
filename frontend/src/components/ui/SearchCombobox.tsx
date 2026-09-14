import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import styles from './Input.module.css';
import comboStyles from './SearchCombobox.module.css';

export interface SearchComboboxItem {
  key: string;
  code: string;
  description: string;
}

interface SearchComboboxProps<T extends SearchComboboxItem> {
  label?: string;
  placeholder?: string;
  items: T[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  minChars?: number;
  debounceMs?: number;
  onQueryChange: (query: string) => void;
  onSelect: (item: T) => void;
  renderItem?: (item: T) => ReactNode;
}

/**
 * Combobox de busca genérico (código ou descrição), com debounce e navegação por teclado.
 * Base reutilizável para ProdutoSearch/ServicoSearch/ClienteSearch/EquipamentoSearch —
 * cada instância concreta só passa `items`/`isLoading` vindos de um hook de dados próprio.
 */
export function SearchCombobox<T extends SearchComboboxItem>({
  label,
  placeholder = 'Digite o código ou a descrição',
  items,
  isLoading,
  isError,
  errorMessage = 'Não foi possível buscar agora. Tente novamente.',
  minChars = 1,
  debounceMs = 300,
  onQueryChange,
  onSelect,
  renderItem,
}: SearchComboboxProps<T>) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debouncedQuery = useDebouncedValue(query, debounceMs);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const listboxId = useId();

  useEffect(() => {
    if (debouncedQuery.trim().length >= minChars) {
      onQueryChange(debouncedQuery.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, minChars]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showResults = open && query.trim().length >= minChars;

  function selectItem(item: T) {
    onSelect(item);
    setQuery('');
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!showResults) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && items[activeIndex]) {
        e.preventDefault();
        selectItem(items[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className={styles.field} ref={wrapperRef}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
      )}
      <div className={comboStyles.wrapper}>
        <input
          id={inputId}
          className={styles.input}
          role="combobox"
          aria-expanded={showResults}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined}
          autoComplete="off"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />

        {showResults && (
          <ul id={listboxId} role="listbox" className={comboStyles.listbox}>
            {isLoading && <li className={comboStyles.status}>Buscando...</li>}
            {isError && !isLoading && (
              <li className={comboStyles.status} role="alert">
                {errorMessage}
              </li>
            )}
            {!isLoading && !isError && items.length === 0 && (
              <li className={comboStyles.status}>Nenhum resultado encontrado.</li>
            )}
            {!isLoading &&
              !isError &&
              items.map((item, index) => (
                <li
                  key={item.key}
                  id={`${listboxId}-opt-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={`${comboStyles.option} ${index === activeIndex ? comboStyles.optionActive : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectItem(item);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  {renderItem ? (
                    renderItem(item)
                  ) : (
                    <>
                      <span>{item.description}</span>
                      <span className={comboStyles.optionCode}>{item.code}</span>
                    </>
                  )}
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}
