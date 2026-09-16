import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { listarOS } from '../api/os.api.js';
import { OS_STATUS_ABERTOS, OS_STATUS_CONFIG } from '../constants/osStatus.js';
import { hasPermission } from '../store/authStore.js';
import {
  Button,
  EmptyState,
  ErrorState,
  LinkButton,
  MetricCard,
  PageHeader,
  Pagination,
  PriorityBadge,
  RefreshButton,
  Select,
  Skeleton,
  StatusBadge,
  Table,
  type TableColumn,
} from '../components/ui/index.js';
import type { OrdemServicoDTO, OSStatus } from '../types/os.types.js';
import styles from './OSListPage.module.css';

const STATUS_OPTIONS = OS_STATUS_ABERTOS.map((value) => ({ value, label: OS_STATUS_CONFIG[value].label }));
const LIMIT = 20;

function formatMoney(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

/** Lista de OS abertas: mantém o filtro e a paginação que já existem, apenas com nova composição visual. */
export function OSListPage() {
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status');
  const [status, setStatus] = useState<OSStatus | 'AGUARDANDO' | ''>(() => initialStatus === 'AGUARDANDO' || STATUS_OPTIONS.some((option) => option.value === initialStatus) || initialStatus === 'CONCLUIDA' || initialStatus === 'CANCELADA' ? initialStatus as OSStatus | 'AGUARDANDO' : '');
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const canSeeFinancial = hasPermission('FINANCIAL_VIEW');

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['os-list', status, page],
    queryFn: () => listarOS({ status: status || undefined, page, limit: LIMIT }),
  });

  function handleStatusChange(value: string) {
    setStatus(value as OSStatus | 'AGUARDANDO');
    setPage(1);
  }

  const columns: TableColumn<OrdemServicoDTO>[] = [
    { key: 'numero', header: 'OS', mono: true, width: '80px', render: (os) => `#${os.numero}` },
    {
      key: 'cliente',
      header: 'Cliente',
      render: (os) => (
        <span>
          <span className={styles.codigo}>{os.clienteCodigo}</span> {os.clienteNome ?? ''}
        </span>
      ),
    },
    {
      key: 'veiculo',
      header: 'Veículo',
      render: (os) => (
        <span>
          <span className={styles.codigo}>{os.equipamentoCodigo}</span> {os.equipamentoDescricao ?? ''}
        </span>
      ),
    },
    {
      key: 'abertura',
      header: 'Abertura',
      mono: true,
      width: '110px',
      render: (os) => new Date(os.dataAbertura).toLocaleDateString('pt-BR'),
    },
    { key: 'status', header: 'Status', width: '148px', render: (os) => <StatusBadge status={os.status} /> },
    { key: 'prioridade', header: 'Prioridade', width: '92px', render: (os) => <PriorityBadge priority={os.prioridade} /> },
    ...(canSeeFinancial
      ? [
          {
            key: 'valor',
            header: 'Valor',
            align: 'right' as const,
            mono: true,
            width: '110px',
            render: (os: OrdemServicoDTO) => (typeof os.faturamento === 'number' ? formatMoney(os.faturamento) : '—'),
          },
        ]
      : []),
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        title="Ordens de Serviço"
        description="Acompanhe as ordens em aberto e acesse os detalhes para continuar o atendimento."
        actions={
          <>
            <RefreshButton onClick={() => refetch()} loading={isFetching} />
            {hasPermission('OS_CREATE') && (
              <LinkButton to="/os/nova" size="sm">
                + Nova OS
              </LinkButton>
            )}
          </>
        }
      />

      <section className={styles.toolbar} aria-label="Filtros da lista de ordens de serviço">
        <Select
          label="Status"
          placeholder="Todos os status em aberto"
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
          options={STATUS_OPTIONS}
        />
      </section>

      {data && !isLoading && !isError && <MetricCard label="OS em aberto" value={data.total.toLocaleString('pt-BR')} />}

      <section className={styles.content} aria-live="polite">
        {isLoading && (
          <div className={styles.loading}>
            <Skeleton height={52} />
            <Skeleton height={52} />
            <Skeleton height={52} />
            <Skeleton height={52} />
          </div>
        )}

        {isError && <ErrorState action={<Button onClick={() => refetch()}>Tentar de novo</Button>} />}

        {!isLoading && !isError && data?.items.length === 0 && (
          <EmptyState title="Nenhuma OS em aberto encontrada" description="Ajuste o filtro ou crie uma nova OS." />
        )}

        {!isLoading && !isError && data && data.items.length > 0 && (
          <>
            <Table columns={columns} data={data.items} rowKey={(os) => os.id} onRowClick={(os) => navigate(`/os/${os.id}`)} />
            <div className={styles.pagination}>
              <Pagination page={page} limit={LIMIT} total={data.total} onPageChange={setPage} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
