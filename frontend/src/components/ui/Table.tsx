import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import styles from './Table.module.css';

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right';
  /** Números/códigos — usa --font-mono com tabular-nums pra colunas alinharem. */
  mono?: boolean;
  sortable?: boolean;
  /** Largura fixa (ex. "132px") — evita a coluna "pular" de tamanho conforme o conteúdo de cada linha. */
  width?: string;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSortChange?: (key: string) => void;
  /** Chave única (por tela) — liga redimensionar/reordenar colunas tipo planilha, persistido no navegador. */
  columnPrefsKey?: string;
  /** Conteúdo resumido do cartão no mobile. O desktop continua usando as colunas da tabela. */
  renderMobileCard?: (row: T) => ReactNode;
}

interface ColumnPrefs {
  order: string[];
  widths: Record<string, number>;
}

function loadPrefs(key: string): ColumnPrefs | null {
  try {
    const raw = localStorage.getItem(`table-prefs:${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.order) || typeof parsed?.widths !== 'object') return null;
    return parsed as ColumnPrefs;
  } catch {
    return null;
  }
}

function savePrefs(key: string, prefs: ColumnPrefs) {
  try {
    localStorage.setItem(`table-prefs:${key}`, JSON.stringify(prefs));
  } catch {
    // Navegador privado/bloqueado — só perde a preferência salva, tabela continua funcionando.
  }
}

const MIN_WIDTH = 56;

/**
 * Tabela genérica (cabeçalho fixo, coluna ordenável por clique, linha com hover/clique) —
 * base compartilhada por Produtos, Clientes e OS. Com `columnPrefsKey`, também permite
 * redimensionar (arrastar borda) e reordenar colunas (arrastar cabeçalho) tipo planilha,
 * lembrando por navegador via localStorage — nunca sincroniza entre dispositivos/usuários.
 */
export function Table<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  sortBy,
  sortOrder,
  onSortChange,
  columnPrefsKey,
  renderMobileCard,
}: TableProps<T>) {
  const [order, setOrder] = useState<string[] | null>(null);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const dragKey = useRef<string | null>(null);
  const resizing = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  // Carrega preferência salva quando a chave muda (troca de tela/aba) — só uma vez por chave.
  useEffect(() => {
    if (!columnPrefsKey) {
      setOrder(null);
      setWidths({});
      return;
    }
    const prefs = loadPrefs(columnPrefsKey);
    setOrder(prefs?.order ?? null);
    setWidths(prefs?.widths ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnPrefsKey]);

  // Ordem exibida: aplica a ordem salva, acrescenta colunas novas no fim, descarta chaves que sumiram.
  const displayColumns = useMemo(() => {
    if (!order) return columns;
    const byKey = new Map(columns.map((c) => [c.key, c]));
    const ordenadas = order.map((k) => byKey.get(k)).filter((c): c is TableColumn<T> => Boolean(c));
    const faltando = columns.filter((c) => !order.includes(c.key));
    return [...ordenadas, ...faltando];
  }, [columns, order]);

  function persist(nextOrder: string[], nextWidths: Record<string, number>) {
    if (!columnPrefsKey) return;
    savePrefs(columnPrefsKey, { order: nextOrder, widths: nextWidths });
  }

  function handleDragStart(key: string) {
    if (!columnPrefsKey) return;
    dragKey.current = key;
  }

  function handleDrop(targetKey: string) {
    if (!columnPrefsKey || !dragKey.current || dragKey.current === targetKey) return;
    const atual = displayColumns.map((c) => c.key);
    const from = atual.indexOf(dragKey.current);
    const to = atual.indexOf(targetKey);
    if (from === -1 || to === -1) return;
    const proxima = [...atual];
    proxima.splice(from, 1);
    proxima.splice(to, 0, dragKey.current);
    dragKey.current = null;
    setOrder(proxima);
    persist(proxima, widths);
  }

  function handleResizeStart(key: string, e: React.MouseEvent, currentWidth: number) {
    if (!columnPrefsKey) return;
    e.preventDefault();
    e.stopPropagation();
    resizing.current = { key, startX: e.clientX, startWidth: currentWidth };

    function onMove(ev: MouseEvent) {
      if (!resizing.current) return;
      const delta = ev.clientX - resizing.current.startX;
      const novaLargura = Math.max(MIN_WIDTH, Math.round(resizing.current.startWidth + delta));
      setWidths((w) => ({ ...w, [resizing.current!.key]: novaLargura }));
    }
    function onUp() {
      if (resizing.current) {
        setWidths((w) => {
          persist(
            displayColumns.map((c) => c.key),
            w,
          );
          return w;
        });
      }
      resizing.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function colunaWidth(col: TableColumn<T>, thEl?: HTMLElement | null): number {
    const savedWidth = widths[col.key];
    if (savedWidth !== undefined) return savedWidth;
    if (col.width) return parseInt(col.width, 10) || 120;
    return thEl?.offsetWidth ?? 120;
  }

  // Mobile: mesma coluna "ações" (header vazio, cheia de botões) vira um rodapé de card em vez
  // de mais uma linha rotulada — o resto das colunas vira par rótulo/valor, sem precisar que cada
  // tela (OS/Clientes/Produtos) declare nada a mais pra ganhar o modo cartão.
  const actionColumn = displayColumns.find((col) => col.header === '');
  const fieldColumns = displayColumns.filter((col) => col.header !== '');

  return (
    <div className={styles.wrapper}>
      <div className={styles.cardList}>
        {data.map((row) => (
          <div
            key={rowKey(row)}
            className={[styles.card, onRowClick ? styles.cardClickable : '']
              .filter(Boolean)
              .join(' ')}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            {renderMobileCard ? (
              renderMobileCard(row)
            ) : (
              <>
                {fieldColumns.map((col) => (
                  <div key={col.key} className={styles.cardField}>
                    <span className={styles.cardLabel}>{col.header}</span>
                    <span
                      className={[styles.cardValue, col.mono ? styles.mono : '']
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {col.render(row)}
                    </span>
                  </div>
                ))}
                {actionColumn && (
                  <div className={styles.cardActions}>{actionColumn.render(row)}</div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            {displayColumns.map((col) => {
              const isSorted = sortBy === col.key;
              const clickable = col.sortable && onSortChange;
              const larguraSalva = widths[col.key];
              return (
                <th
                  key={col.key}
                  draggable={Boolean(columnPrefsKey)}
                  onDragStart={() => handleDragStart(col.key)}
                  onDragOver={(e) => columnPrefsKey && e.preventDefault()}
                  onDrop={() => handleDrop(col.key)}
                  className={[
                    styles.th,
                    col.align === 'right' ? styles.alignRight : '',
                    clickable ? styles.sortable : '',
                    columnPrefsKey ? styles.thDraggable : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={
                    larguraSalva
                      ? { width: `${larguraSalva}px` }
                      : col.width
                        ? { width: col.width }
                        : undefined
                  }
                  aria-sort={
                    isSorted ? (sortOrder === 'desc' ? 'descending' : 'ascending') : undefined
                  }
                >
                  {clickable ? (
                    <button type="button" className={styles.thButton} onClick={() => onSortChange(col.key)}>
                      {col.header}
                      <span className={styles.sortIcon} aria-hidden="true">
                        {isSorted ? (sortOrder === 'desc' ? '↓' : '↑') : '↕'}
                      </span>
                    </button>
                  ) : (
                    <span className={styles.thContent}>{col.header}</span>
                  )}
                  {columnPrefsKey && (
                    <span
                      className={styles.resizeHandle}
                      onMouseDown={(e) => {
                        const th = (e.target as HTMLElement).closest('th');
                        handleResizeStart(col.key, e, colunaWidth(col, th));
                      }}
                      onClick={(e) => e.stopPropagation()}
                      aria-hidden="true"
                    />
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={rowKey(row)}
              className={onRowClick ? styles.rowClickable : ''}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {displayColumns.map((col) => (
                <td
                  key={col.key}
                  className={[
                    styles.td,
                    col.align === 'right' ? styles.alignRight : '',
                    col.mono ? styles.mono : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
