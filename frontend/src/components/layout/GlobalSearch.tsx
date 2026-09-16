import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { searchDashboard } from '../../api/dashboard.api.js';
import styles from './GlobalSearch.module.css';

export function GlobalSearch() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value.trim()), 260);
    return () => window.clearTimeout(timer);
  }, [value]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); inputRef.current?.focus(); setOpen(true);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  const { data, isFetching } = useQuery({ queryKey: ['global-search', debounced], queryFn: () => searchDashboard(debounced), enabled: debounced.length >= 2, staleTime: 15_000 });
  function select(result: NonNullable<typeof data>[number]) {
    setOpen(false); setValue('');
    navigate(result.tipo === 'OS' ? `/os/${result.id}` : `/clientes?busca=${encodeURIComponent(result.titulo)}`);
  }
  return <div className={styles.wrapper}>
    <span className={styles.icon}>⌕</span>
    <input ref={inputRef} value={value} onChange={(event) => { setValue(event.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Buscar OS, cliente, placa ou serviço..." aria-label="Busca global" />
    <kbd>Ctrl + K</kbd>
    {open && value.trim().length >= 2 && <div className={styles.results}>{isFetching && <p>Buscando...</p>}{!isFetching && data?.length === 0 && <p>Nenhum resultado encontrado.</p>}{data?.map((result) => <button key={`${result.tipo}-${result.id}`} onMouseDown={(event) => event.preventDefault()} onClick={() => select(result)}><span>{result.tipo === 'OS' ? 'OS' : 'CLIENTE'}</span><strong>{result.titulo}</strong><small>{result.descricao}</small></button>)}</div>}
  </div>;
}
