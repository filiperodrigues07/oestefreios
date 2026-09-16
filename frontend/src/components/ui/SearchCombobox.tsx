import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import styles from './Input.module.css';
import comboStyles from './SearchCombobox.module.css';

export interface SearchComboboxItem {
  key: string;
  code: string;
  description: string;
}

export interface SearchComboboxHandle {
  focus: () => void;
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
  /** Enter sem nenhuma opção destacada (lista fechada ou vazia) — usado por grids que avançam pro próximo campo. */
  onEnterWithoutSelection?: () => void;
}

/**
 * Combobox de busca genérico (código ou descrição), com debounce, navegação por teclado e
 * F8 pra abrir a lista completa mesmo sem nada digitado — convenção de ERP (CHERP) aplicada
 * de uma vez só aqui pra valer em todo canto que usa este componente. Base reutilizável para
 * ProdutoSearch/ServicoSearch/ClienteSearch/EquipamentoSearch/ItemGrid.
 */
function SearchComboboxInner<T extends SearchComboboxItem>(
  {
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
    onEnterWithoutSelection,
  }: SearchComboboxProps<T>,
  ref: Ref<SearchComboboxHandle>,
) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  /** F8 força a lista a abrir mesmo com o campo vazio/abaixo de `minChars` — convenção de ERP (CHERP). */
  const [forcedShow, setForcedShow] = useState(false);
  const debouncedQuery = useDebouncedValue(query, debounceMs);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const listboxId = useId();

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }));

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

  const showResults = open && (query.trim().length >= minChars || forcedShow);

  function selectItem(item: T) {
    onSelect(item);
    setQuery('');
    setOpen(false);
    setActiveIndex(-1);
    setForcedShow(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'F8') {
      // Convenção de ERP: F8 abre a busca completa, mesmo sem nada digitado ainda.
      e.preventDefault();
      setForcedShow(true);
      setOpen(true);
      onQueryChange(query.trim());
      return;
    }
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
      } else if (onEnterWithoutSelection) {
        e.preventDefault();
        onEnterWithoutSelection();
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
          ref={inputRef}
          id={inputId}
          className={`${styles.input} ${comboStyles.inputWithHint}`}
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
            setForcedShow(false);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        <span className={comboStyles.hint}>F8 lista tudo</span>

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

export const SearchCombobox = forwardRef(SearchComboboxInner) as <T extends SearchComboboxItem>(
  props: SearchComboboxProps<T> & { ref?: Ref<SearchComboboxHandle> },
) => ReturnType<typeof SearchComboboxInner>;
