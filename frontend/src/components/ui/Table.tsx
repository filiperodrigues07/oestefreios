import type { ReactNode } from 'react';
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
}

/**
 * Tabela genérica (cabeçalho fixo, coluna ordenável por clique, linha com hover/clique) —
 * base compartilhada por Produtos, Clientes e Usuários em vez de reconstruir a mesma
 * estrutura em cada tela.
 */
export function Table<T>({ columns, data, rowKey, onRowClick, sortBy, sortOrder, onSortChange }: TableProps<T>) {
  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((col) => {
              const isSorted = sortBy === col.key;
              const clickable = col.sortable && onSortChange;
              return (
                <th
                  key={col.key}
                  className={[styles.th, col.align === 'right' ? styles.alignRight : '', clickable ? styles.sortable : '']
                    .filter(Boolean)
                    .join(' ')}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={clickable ? () => onSortChange(col.key) : undefined}
                  aria-sort={isSorted ? (sortOrder === 'desc' ? 'descending' : 'ascending') : undefined}
                >
                  <span className={styles.thContent}>
                    {col.header}
                    {clickable && (
                      <span className={styles.sortIcon} aria-hidden="true">
                        {isSorted ? (sortOrder === 'desc' ? '↓' : '↑') : '↕'}
                      </span>
                    )}
                  </span>
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
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={[styles.td, col.align === 'right' ? styles.alignRight : '', col.mono ? styles.mono : '']
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
