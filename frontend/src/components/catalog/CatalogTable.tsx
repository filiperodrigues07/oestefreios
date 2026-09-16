import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { CatalogParams } from '../../api/catalog.types.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { Button, EmptyState, ErrorState, Pagination, SearchInput, Skeleton, Table, type TableColumn } from '../ui/index.js';
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
}

/** Data table compartilhada para catálogos; preserva a ordenação e paginação já suportadas pelo backend. */
export function CatalogTable<T extends CatalogItemBase>({ fetchFn, queryKey, columns, onSelect, emptyLabel }: CatalogTableProps<T>) {
  const [filtroInput, setFiltroInput] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'codigo' | 'descricao'>('descricao');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const filtro = useDebouncedValue(filtroInput, 300);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [queryKey, filtro, page, sortBy, sortOrder],
    queryFn: () => fetchFn({ filtro, page, limit: 10, sortBy, sortOrder }),
  });

  function handleSortChange(key: string) {
    if (key !== 'codigo' && key !== 'descricao') return;
    if (key === sortBy) {
      setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortOrder('asc');
    }
    setPage(1);
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <SearchInput
          placeholder="Buscar por código ou descrição"
          value={filtroInput}
          onChange={(event) => {
            setFiltroInput(event.target.value);
            setPage(1);
          }}
        />
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
          />
          <div className={styles.pagination}>
            <Pagination page={data.page} limit={data.limit} total={data.total} onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
