import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { CatalogParams, CatalogSortBy } from '../../api/catalog.types.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { Button, EmptyState, ErrorState, ExportButtons, Pagination, SearchInput, Skeleton, Table, type TableColumn } from '../ui/index.js';
import styles from './CatalogTable.module.css';

interface CatalogItemBase {
  codigo: string;
  descricao: string;
  unidade: string;
}

interface CatalogTableProps<T extends CatalogItemBase> {
  fetchFn: (params: CatalogParams) => Promise<{ items: T[]; page: number; limit: number; total: number }>;
  queryKey: string;
  columns: TableColumn<T>[];
  onSelect: (item: T) => void;
  emptyLabel: string;
  searchPlaceholder?: string;
  columnPrefsKey?: string;
  onExportarExcel?: (busca: string) => Promise<void>;
  onExportarPdf?: (busca: string) => Promise<void>;
}

const SORTAVEIS: CatalogSortBy[] = ['codigo', 'descricao', 'categoria', 'tipo'];

/** Data table compartilhada para catálogos; preserva a ordenação e paginação já suportadas pelo backend. */
export function CatalogTable<T extends CatalogItemBase>({
  fetchFn,
  queryKey,
  columns,
  onSelect,
  emptyLabel,
  searchPlaceholder,
  columnPrefsKey,
  onExportarExcel,
  onExportarPdf,
}: CatalogTableProps<T>) {
  const [filtroInput, setFiltroInput] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [sortBy, setSortBy] = useState<CatalogSortBy>('descricao');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const filtro = useDebouncedValue(filtroInput, 300);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [queryKey, filtro, page, limit, sortBy, sortOrder],
    queryFn: () => fetchFn({ filtro, page, limit, sortBy, sortOrder }),
  });

  function handleLimitChange(novoLimit: number) {
    setLimit(novoLimit);
    setPage(1);
  }

  function handleSortChange(key: string) {
    if (!SORTAVEIS.includes(key as CatalogSortBy)) return;
    if (key === sortBy) {
      setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key as CatalogSortBy);
      setSortOrder('asc');
    }
    setPage(1);
  }

  return (
    <div>
      {data && !isLoading && !isError && (
        <p className={styles.total}>
          <strong>{data.total.toLocaleString('pt-BR')}</strong> {data.total === 1 ? 'registro' : 'registros'}
        </p>
      )}

      <div className={styles.toolbar}>
        <SearchInput
          placeholder={searchPlaceholder ?? 'Buscar por código, descrição ou categoria'}
          value={filtroInput}
          onChange={(event) => {
            setFiltroInput(event.target.value);
            setPage(1);
          }}
        />
        {onExportarExcel && onExportarPdf && (
          <ExportButtons onExportarExcel={() => onExportarExcel(filtro)} onExportarPdf={() => onExportarPdf(filtro)} />
        )}
      </div>

      {isLoading && (
        <div className={styles.loading}>
          <Skeleton height={44} />
          <Skeleton height={44} />
          <Skeleton height={44} />
        </div>
      )}

      {isError && <ErrorState action={<Button variant="secondary" onClick={() => refetch()}>Tentar de novo</Button>} />}

      {!isLoading && !isError && data?.items.length === 0 && <EmptyState title={emptyLabel} />}

      {!isLoading && !isError && data && data.items.length > 0 && (
        <>
          <Table
            columns={columns}
            data={data.items}
            rowKey={(item) => item.codigo}
            onRowClick={onSelect}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
            columnPrefsKey={columnPrefsKey}
          />
          <div className={styles.pagination}>
            <Pagination page={data.page} limit={data.limit} total={data.total} onPageChange={setPage} onLimitChange={handleLimitChange} />
          </div>
        </>
      )}
    </div>
  );
}
