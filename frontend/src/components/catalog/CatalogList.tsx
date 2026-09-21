import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import type { CatalogParams } from '../../api/catalog.types.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { Card, EmptyState, ErrorState, Input, Pagination, Select, Skeleton } from '../ui/index.js';

interface CatalogItemBase {
  codigo: string;
  descricao: string;
  unidade: string;
}

interface CatalogListProps<T extends CatalogItemBase> {
  fetchFn: (params: CatalogParams) => Promise<{ items: T[]; page: number; limit: number; total: number }>;
  queryKey: string;
  /** Texto de preço já formatado (ex. "R$ 50,00"), só quando o backend enviou o campo (FINANCIAL_VIEW). */
  renderPrice?: (item: T) => string | undefined;
  onSelect: (item: T) => void;
  emptyLabel: string;
}

const SORT_OPTIONS = [
  { value: 'descricao', label: 'Descrição' },
  { value: 'codigo', label: 'Código' },
];

/**
 * Catálogo genérico (busca + ordenação + paginação), reaproveitado por
 * Produtos e Serviços (seções 10 e 12 do briefing). Clique no item abre o
 * detalhe via `onSelect` — quem chama decide o que fazer (modal, navegação).
 */
export function CatalogList<T extends CatalogItemBase>({
  fetchFn,
  queryKey,
  renderPrice,
  onSelect,
  emptyLabel,
}: CatalogListProps<T>) {
  const [filtroInput, setFiltroInput] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'codigo' | 'descricao'>('descricao');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const filtro = useDebouncedValue(filtroInput, 300);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [queryKey, filtro, page, sortBy, sortOrder],
    queryFn: () => fetchFn({ filtro, page, limit: 10, sortBy, sortOrder }),
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
        <div style={{ flex: '1 1 220px' }}>
          <Input
            placeholder="Buscar por código ou descrição"
            value={filtroInput}
            onChange={(e) => {
              setFiltroInput(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div style={{ width: 160 }}>
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'codigo' | 'descricao')}
            options={SORT_OPTIONS}
          />
        </div>
        <button
          type="button"
          onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
          aria-label={sortOrder === 'asc' ? 'Ordem crescente' : 'Ordem decrescente'}
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-surface)',
            minHeight: 40,
            minWidth: 40,
            cursor: 'pointer',
            fontSize: 'var(--font-size-md)',
          }}
        >
          {sortOrder === 'asc' ? '↑' : '↓'}
        </button>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <Skeleton height={56} />
          <Skeleton height={56} />
          <Skeleton height={56} />
        </div>
      )}

      {isError && <ErrorState error={error} action={<RetryButton onClick={() => refetch()} />} />}

      {!isLoading && !isError && data?.items.length === 0 && <EmptyState title={emptyLabel} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {data?.items.map((item) => (
          <button
            key={item.codigo}
            type="button"
            onClick={() => onSelect(item)}
            style={{ all: 'unset', cursor: 'pointer', display: 'block' }}
          >
            <Card elevated style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{item.descricao}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  {item.codigo} · {item.unidade}
                </div>
              </div>
              {renderPrice?.(item) && <div style={{ fontWeight: 600 }}>{renderPrice(item)}</div>}
            </Card>
          </button>
        ))}
      </div>

      {data && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Pagination page={data.page} limit={data.limit} total={data.total} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}

function RetryButton({ onClick }: { onClick: () => void }): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--color-surface)',
        padding: '8px 14px',
        cursor: 'pointer',
      }}
    >
      Tentar de novo
    </button>
  );
}
