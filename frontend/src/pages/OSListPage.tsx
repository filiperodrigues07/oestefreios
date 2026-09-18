import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { baixarOSPdf, listarOS, type OSSortBy } from '../api/os.api.js';
import { baixarRelatorioOS } from '../api/relatorios.api.js';
import { OS_DOCUMENT_STATUS_CONFIG, OS_DOCUMENT_STATUS_OPTIONS, OS_PRIORIDADE_OPTIONS } from '../constants/osStatus.js';
import { hasPermission } from '../store/authStore.js';
import {
  ActionIcon,
  Button,
  EditButton,
  EmptyState,
  ErrorState,
  ExportButtons,
  LinkButton,
  PageHeader,
  Pagination,
  PrintButton,
  RefreshButton,
  SearchInput,
  Select,
  Skeleton,
  Badge,
  PriorityBadge,
  Table,
  type TableColumn,
} from '../components/ui/index.js';
import type { OrdemServicoDTO, OSPrioridade } from '../types/os.types.js';
import styles from './OSListPage.module.css';

/** Exportar/relatório usa uma janela ampla (366 dias, teto do backend) — a lista em si não tem período. */
function periodoExportacaoPadrao(): { dataInicial: string; dataFinal: string } {
  const fim = new Date();
  const inicio = new Date(fim);
  inicio.setDate(inicio.getDate() - 365);
  return { dataInicial: inicio.toISOString().slice(0, 10), dataFinal: fim.toISOString().slice(0, 10) };
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

/** Lista de OS abertas: filtros inteligentes (busca livre + status + prioridade) e colunas ordenáveis. */
export function OSListPage() {
  const [searchParams] = useSearchParams();
  const initialSituacaoDocumento = searchParams.get('situacaoDocumento');
  const [situacaoDocumento, setSituacaoDocumento] = useState(() =>
    initialSituacaoDocumento !== null && OS_DOCUMENT_STATUS_CONFIG[Number(initialSituacaoDocumento)]
      ? initialSituacaoDocumento
      : '',
  );
  const [prioridade, setPrioridade] = useState<OSPrioridade | ''>('');
  const [busca, setBusca] = useState('');
  const [buscaAtiva, setBuscaAtiva] = useState('');
  const [sortBy, setSortBy] = useState<OSSortBy | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const navigate = useNavigate();
  const canSeeFinancial = hasPermission('FINANCIAL_VIEW');
  const podeEditar = hasPermission('OS_EDIT');

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['os-list', situacaoDocumento, prioridade, buscaAtiva, sortBy, sortOrder, page, limit],
    queryFn: () =>
      listarOS({
        situacaoDocumento: situacaoDocumento === '' ? undefined : Number(situacaoDocumento),
        incluirFinalizadas: true,
        prioridade: prioridade || undefined,
        busca: buscaAtiva || undefined,
        sortBy,
        sortOrder,
        page,
        limit,
      }),
  });

  function handleLimitChange(novoLimit: number) {
    setLimit(novoLimit);
    setPage(1);
  }

  function handleSituacaoDocumentoChange(value: string) {
    setSituacaoDocumento(value);
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
    const sortavel: OSSortBy[] = ['numero', 'clienteNome', 'equipamentoDescricao', 'dataAbertura', 'prioridade', 'faturamento'];
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
    {
      key: 'situacaoDocumento',
      header: 'Situação',
      width: '130px',
      render: (os) => {
        const config = os.situacaoDocumento === undefined ? undefined : OS_DOCUMENT_STATUS_CONFIG[os.situacaoDocumento];
        return <Badge tone={config?.tone ?? 'neutral'}>{config?.label ?? 'Não informado'}</Badge>;
      },
    },
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
    {
      key: 'acoes',
      header: '',
      align: 'right' as const,
      width: podeEditar ? '92px' : '48px',
      render: (os: OrdemServicoDTO) => (
        <div style={{ display: 'inline-flex', gap: 'var(--space-1)' }}>
          <PrintButton label={`Imprimir OS #${os.numero}`} onImprimir={() => baixarOSPdf(os.id, os.numero)} />
          {podeEditar && <EditButton to={`/os/${os.id}`} label={`Editar OS #${os.numero}`} />}
        </div>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        title="Ordens de Serviço"
        description="Consulte as ordens e a situação do documento registrada no CHERP."
        actions={
          <>
            <RefreshButton onClick={() => refetch()} loading={isFetching} />
            {hasPermission('OS_CREATE') && (
              <LinkButton to="/os/nova" size="sm">
                <ActionIcon name="add" />
                Nova OS
              </LinkButton>
            )}
            <ExportButtons
              onExportarExcel={() => baixarRelatorioOS({ ...periodoExportacaoPadrao(), situacaoDocumento: situacaoDocumento === '' ? undefined : Number(situacaoDocumento), prioridade: prioridade || undefined, busca: buscaAtiva || undefined }, 'excel')}
              onExportarPdf={() => baixarRelatorioOS({ ...periodoExportacaoPadrao(), situacaoDocumento: situacaoDocumento === '' ? undefined : Number(situacaoDocumento), prioridade: prioridade || undefined, busca: buscaAtiva || undefined }, 'pdf')}
            />
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
          label="Situação"
          placeholder="Todas as situações"
          value={situacaoDocumento}
          onChange={(e) => handleSituacaoDocumentoChange(e.target.value)}
          options={OS_DOCUMENT_STATUS_OPTIONS}
        />
        <Select
          label="Prioridade"
          placeholder="Todas"
          value={prioridade}
          onChange={(e) => handlePrioridadeChange(e.target.value)}
          options={OS_PRIORIDADE_OPTIONS}
        />
        <Button type="submit" variant="secondary">
          <ActionIcon name="search" />
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
              columnPrefsKey="os"
            />
            <div className={styles.pagination}>
              <Pagination page={page} limit={limit} total={data.total} onPageChange={setPage} onLimitChange={handleLimitChange} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
