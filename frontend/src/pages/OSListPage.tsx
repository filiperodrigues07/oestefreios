import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { listarOS, type OSSortBy } from '../api/os.api.js';
import { OS_PRIORIDADE_OPTIONS, OS_STATUS_ABERTOS, OS_STATUS_CONFIG } from '../constants/osStatus.js';
import { hasPermission } from '../store/authStore.js';
import {
  Button,
  EmptyState,
  ErrorState,
  LinkButton,
  PageHeader,
  Pagination,
  RefreshButton,
  SearchInput,
  Select,
  Skeleton,
  StatusBadge,
  PriorityBadge,
  Table,
  type TableColumn,
} from '../components/ui/index.js';
import type { OrdemServicoDTO, OSPrioridade, OSStatus } from '../types/os.types.js';
import styles from './OSListPage.module.css';

const STATUS_OPTIONS = OS_STATUS_ABERTOS.map((value) => ({ value, label: OS_STATUS_CONFIG[value].label }));
const LIMIT = 20;

function formatMoney(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

/** Lista de OS abertas: filtros inteligentes (busca livre + status + prioridade) e colunas ordenáveis. */
export function OSListPage() {
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status');
  const [status, setStatus] = useState<OSStatus | 'AGUARDANDO' | ''>(() => initialStatus === 'AGUARDANDO' || STATUS_OPTIONS.some((option) => option.value === initialStatus) || initialStatus === 'CONCLUIDA' || initialStatus === 'CANCELADA' ? initialStatus as OSStatus | 'AGUARDANDO' : '');
  const [prioridade, setPrioridade] = useState<OSPrioridade | ''>('');
  const [busca, setBusca] = useState('');
  const [buscaAtiva, setBuscaAtiva] = useState('');
  const [sortBy, setSortBy] = useState<OSSortBy | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const canSeeFinancial = hasPermission('FINANCIAL_VIEW');

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['os-list', status, prioridade, buscaAtiva, sortBy, sortOrder, page],
    queryFn: () =>
      listarOS({
        status: status || undefined,
        prioridade: prioridade || undefined,
        busca: buscaAtiva || undefined,
        sortBy,
        sortOrder,
        page,
        limit: LIMIT,
      }),
  });

  function handleStatusChange(value: string) {
    setStatus(value as OSStatus | 'AGUARDANDO');
    setPage(1);
  }

  function handlePrioridadeChange(value: string) {
    setPrioridade(value as OSPrioridade | '');
    setPage(1);
  }

  function handleBuscar(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setBuscaAtiva(busca.trim());
  }

  function handleSortChange(key: string) {
    const sortavel: OSSortBy[] = ['numero', 'clienteNome', 'equipamentoDescricao', 'dataAbertura', 'status', 'prioridade', 'faturamento'];
    if (!sortavel.includes(key as OSSortBy)) return;
    if (key === sortBy) {
      setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key as OSSortBy);
      setSortOrder('asc');
    }
    setPage(1);
  }

  const columns: TableColumn<OrdemServicoDTO>[] = [
    { key: 'numero', header: 'OS', mono: true, width: '76px', sortable: true, render: (os) => `#${os.numero}` },
    { key: 'clienteCodigo', header: 'Cód. cliente', mono: true, width: '100px', render: (os) => os.clienteCodigo },
    { key: 'clienteNome', header: 'Cliente', sortable: true, render: (os) => os.clienteNome ?? '—' },
    { key: 'veiculoCodigo', header: 'Cód. veículo', mono: true, width: '100px', render: (os) => os.equipamentoCodigo },
    { key: 'equipamentoDescricao', header: 'Placa', mono: true, width: '110px', sortable: true, render: (os) => os.equipamentoDescricao ?? '—' },
    {
      key: 'dataAbertura',
      header: 'Abertura',
      mono: true,
      width: '108px',
      sortable: true,
      render: (os) => new Date(os.dataAbertura).toLocaleDateString('pt-BR'),
    },
    { key: 'status', header: 'Status', width: '164px', sortable: true, render: (os) => <StatusBadge status={os.status} /> },
    { key: 'prioridade', header: 'Prioridade', width: '108px', sortable: true, render: (os) => <PriorityBadge priority={os.prioridade} /> },
    ...(canSeeFinancial
      ? [
          {
            key: 'faturamento',
            header: 'Valor',
            align: 'right' as const,
            mono: true,
            width: '128px',
            sortable: true,
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

      {data && !isLoading && !isError && (
        <p className={styles.total}>
          <strong>{data.total.toLocaleString('pt-BR')}</strong> {data.total === 1 ? 'registro' : 'registros'}
        </p>
      )}

      <form onSubmit={handleBuscar} className={styles.toolbar} aria-label="Filtros da lista de ordens de serviço">
        <SearchInput
          placeholder="Buscar por Nº OS, cliente, código ou placa"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <Select
          label="Status"
          placeholder="Todos os status em aberto"
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
          options={STATUS_OPTIONS}
        />
        <Select
          label="Prioridade"
          placeholder="Todas"
          value={prioridade}
          onChange={(e) => handlePrioridadeChange(e.target.value)}
          options={OS_PRIORIDADE_OPTIONS}
        />
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

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
          <EmptyState title="Nenhuma OS encontrada" description="Ajuste os filtros ou crie uma nova OS." />
        )}

        {!isLoading && !isError && data && data.items.length > 0 && (
          <>
            <Table
              columns={columns}
              data={data.items}
              rowKey={(os) => os.id}
              onRowClick={(os) => navigate(`/os/${os.id}`)}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={handleSortChange}
            />
            <div className={styles.pagination}>
              <Pagination page={page} limit={LIMIT} total={data.total} onPageChange={setPage} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
