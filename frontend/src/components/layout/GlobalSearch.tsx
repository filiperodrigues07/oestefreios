import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { searchDashboard, type DashboardSearchResult } from '../../api/dashboard.api.js';
import styles from './GlobalSearch.module.css';

const LABELS: Record<DashboardSearchResult['tipo'], string> = {
  OS: 'OS', CLIENTE: 'Cliente', VEICULO: 'Veículo', PRODUTO: 'Produto', SERVICO: 'Serviço',
};

function destino(result: DashboardSearchResult): string {
  if (result.tipo === 'OS') return `/os/${result.id}`;
  if (result.tipo === 'CLIENTE') return `/clientes?busca=${encodeURIComponent(result.id)}`;
  if (result.tipo === 'VEICULO') return `/veiculos?busca=${encodeURIComponent(result.titulo)}`;
  return `/produtos?tipo=${result.tipo === 'SERVICO' ? 'servicos' : 'produtos'}&busca=${encodeURIComponent(result.id)}`;
}

/** Mostra ⌘ K no Mac e Ctrl K no resto — o atalho em si já aceita os dois. */
const ATALHO = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform) ? '⌘ K' : 'Ctrl K';

export function GlobalSearch({ onNavigate, className, placeholder, shortcut = true }: { onNavigate?: () => void; className?: string; placeholder?: string; shortcut?: boolean }) {
  const navigate = useNavigate();
  const listId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value.trim()), 260);
    return () => window.clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (shortcut && inputRef.current?.getClientRects().length && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    const closeOutside = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', handler);
    document.addEventListener('pointerdown', closeOutside);
    return () => {
      window.removeEventListener('keydown', handler);
      document.removeEventListener('pointerdown', closeOutside);
    };
  }, [shortcut]);

  const { data = [], isFetching, isError } = useQuery({
    queryKey: ['global-search', debounced],
    queryFn: () => searchDashboard(debounced),
    enabled: debounced.length >= 2,
    staleTime: 15_000,
  });

  useEffect(() => setActiveIndex(-1), [data, debounced]);

  function select(result: DashboardSearchResult) {
    setOpen(false);
    setValue('');
    onNavigate?.();
    navigate(destino(result));
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!open || data.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % data.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? data.length - 1 : index - 1));
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      const result = data[activeIndex];
      if (result) select(result);
    }
  }

  const showing = open && value.trim().length >= 2;
  return (
    <div className={`${styles.wrapper} ${className ?? ''}`} ref={wrapperRef}>
      <span className={styles.icon} aria-hidden="true">⌕</span>
      <input ref={inputRef} value={value}
        onChange={(event) => { setValue(event.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} onKeyDown={handleKeyDown}
        placeholder={placeholder ?? 'Buscar OS, cliente, placa, produto ou serviço...'} aria-label="Busca global"
        aria-keyshortcuts="Control+K Meta+K" role="combobox" aria-expanded={showing} aria-controls={showing ? listId : undefined}
        aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined} />
      {value && <button className={styles.clear} type="button" onClick={() => { setValue(''); inputRef.current?.focus(); }} aria-label="Limpar busca">×</button>}
      {!value && <kbd aria-hidden="true">{ATALHO}</kbd>}
      {showing && <div className={styles.results} id={listId} role="listbox">
        {isFetching && <p>Buscando...</p>}
        {isError && <p>Não foi possível realizar a busca. Tente novamente.</p>}
        {!isFetching && !isError && data.length === 0 && <p>Nenhum resultado encontrado.</p>}
        {!isFetching && data.map((result, index) => <button id={`${listId}-${index}`}
          key={`${result.tipo}-${result.id}`} type="button" role="option"
          aria-selected={index === activeIndex} className={index === activeIndex ? styles.active : undefined}
          onMouseEnter={() => setActiveIndex(index)} onClick={() => select(result)}>
          <span>{LABELS[result.tipo]}</span><strong>{result.titulo}</strong><small>{result.descricao}</small>
        </button>)}
        {!isFetching && !isError && data.length > 0 && <div className={styles.hint}>↑ ↓ para navegar · Enter para abrir</div>}
      </div>}
    </div>
  );
}
