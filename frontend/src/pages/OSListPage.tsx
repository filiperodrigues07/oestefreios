import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { baixarOSPdf, duplicarOS, excluirOS, listarOS, type OSSortBy } from '../api/os.api.js';
import { handleMutationError } from '../pwa/offlineErrorToast.js';
import { baixarRelatorioOS } from '../api/relatorios.api.js';
import { CurrencyCell } from '../components/ui/CurrencyCell.js';
import {
  OS_DOCUMENT_STATUS_CONFIG,
  OS_DOCUMENT_STATUS_OPTIONS,
  OS_PRIORIDADE_OPTIONS,
} from '../constants/osStatus.js';
import { hasPermission } from '../store/authStore.js';
import { readStoredFilters, writeStoredFilters } from '../utils/filterStorage.js';
import {
  ActionIcon,
  Button,
  ConfirmDialog,
  EditButton,
  EmptyState,
  ErrorState,
  ExportButtons,
  Input,
  LinkButton,
  MobileRecordCard,
  MobileFab,
  PageHeader,
  Pagination,
  PrintButton,
  ReasonDialog,
  RefreshButton,
  RowActionButton,
  ResultsSummary,
  SearchInput,
  ResponsiveFilters,
  Select,
  Skeleton,
  Badge,
  PriorityBadge,
  Table,
  useToast,
  type TableColumn,
} from '../components/ui/index.js';
import type { OrdemServicoDTO, OSPrioridade } from '../types/os.types.js';
import styles from './OSListPage.module.css';

/** Exportar/relatório usa uma janela ampla (366 dias, teto do backend) — a lista em si não tem período. */
function periodoExportacaoPadrao(): { dataInicial: string; dataFinal: string } {
  const fim = new Date();
  const inicio = new Date(fim);
  inicio.setDate(inicio.getDate() - 365);
  return {
    dataInicial: inicio.toISOString().slice(0, 10),
    dataFinal: fim.toISOString().slice(0, 10),
  };
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

/** Lista de OS abertas: filtros inteligentes (busca livre + status + prioridade) e colunas ordenáveis. */
export function OSListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filtrosSalvos = readStoredFilters('os');
  const initialSituacaoDocumento = searchParams.get('situacaoDocumento') ?? filtrosSalvos.get('situacaoDocumento');
  const [situacaoDocumento, setSituacaoDocumento] = useState(() =>
    initialSituacaoDocumento === '' || (initialSituacaoDocumento !== null && OS_DOCUMENT_STATUS_CONFIG[Number(initialSituacaoDocumento)])
      ? initialSituacaoDocumento
      : '0',
  );
  const [prioridade, setPrioridade] = useState<OSPrioridade | ''>(() => {
    const value = searchParams.get('prioridade') ?? filtrosSalvos.get('prioridade');
    return value && OS_PRIORIDADE_OPTIONS.some((o) => o.value === value) ? (value as OSPrioridade) : '';
  });
  const [dataInicial, setDataInicial] = useState(() => searchParams.get('dataInicial') ?? filtrosSalvos.get('dataInicial') ?? '');
  const [dataFinal, setDataFinal] = useState(() => searchParams.get('dataFinal') ?? filtrosSalvos.get('dataFinal') ?? '');
  const [busca, setBusca] = useState(() => searchParams.get('busca') ?? filtrosSalvos.get('busca') ?? '');
  const [buscaAtiva, setBuscaAtiva] = useState(() => searchParams.get('busca') ?? filtrosSalvos.get('busca') ?? '');
  const [sortBy, setSortBy] = useState<OSSortBy | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const navigate = useNavigate();
  const canSeeFinancial = hasPermission('FINANCIAL_VIEW');
  const podeEditar = hasPermission('OS_EDIT');
  const podeDuplicar = hasPermission('OS_CREATE');
  const podeExcluir = hasPermission('OS_DELETE');
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [duplicando, setDuplicando] = useState<OrdemServicoDTO | null>(null);
  const [excluindo, setExcluindo] = useState<OrdemServicoDTO | null>(null);

  // Mesma regra do backend (assertNaoFinalizada): só OS aberta pode ser excluída.
  const osExcluivel = (os: OrdemServicoDTO) =>
    podeExcluir && (os.situacaoDocumento === undefined || os.situacaoDocumento === 0) && !os.dataConclusao && !os.travadoLocal;

  const duplicarMutation = useMutation({
    mutationFn: (os: OrdemServicoDTO) => duplicarOS(os.id),
    onSuccess: async (nova) => {
      setDuplicando(null);
      await queryClient.invalidateQueries({ queryKey: ['os-list'] });
      showToast(`OS duplicada como #${nova.numero}.`, 'success');
      navigate(`/os/${nova.id}`);
    },
    onError: (err) => handleMutationError(err, showToast, 'Não foi possível duplicar a OS. Tente novamente.'),
  });

  const excluirMutation = useMutation({
    mutationFn: ({ os, motivo }: { os: OrdemServicoDTO; motivo: string }) => excluirOS(os.id, motivo),
    onSuccess: async (_data, { os }) => {
      setExcluindo(null);
      queryClient.removeQueries({ queryKey: ['os', os.id] });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['os-list'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-operacional'] }),
      ]);
      showToast(`OS #${os.numero} excluída.`, 'success');
    },
    onError: (err) => handleMutationError(err, showToast, 'Não foi possível excluir a OS. Tente novamente.'),
  });

  // Filtros salvos na URL (compartilhável, funciona com voltar do navegador) e em sessionStorage
  // (sobrevive a navegar pra outra tela pelo menu, que troca de rota sem manter query string).
  // `replace` pra não empilhar uma entrada de histórico a cada tecla digitada na busca.
  useEffect(() => {
    const params = new URLSearchParams();
    // Valor vazio significa "todas" e precisa sobreviver a F5; ausência da chave usa o padrão "aberta".
    params.set('situacaoDocumento', situacaoDocumento);
    if (prioridade) params.set('prioridade', prioridade);
    if (dataInicial) params.set('dataInicial', dataInicial);
    if (dataFinal) params.set('dataFinal', dataFinal);
    if (buscaAtiva) params.set('busca', buscaAtiva);
    setSearchParams(params, { replace: true });
    writeStoredFilters('os', params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [situacaoDocumento, prioridade, dataInicial, dataFinal, buscaAtiva]);

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: [
      'os-list',
      situacaoDocumento,
      prioridade,
      dataInicial,
      dataFinal,
      buscaAtiva,
      sortBy,
      sortOrder,
      page,
      limit,
    ],
    queryFn: () =>
      listarOS({
        situacaoDocumento: situacaoDocumento === '' ? undefined : Number(situacaoDocumento),
        incluirFinalizadas: true,
        prioridade: prioridade || undefined,
        dataInicial: dataInicial || undefined,
        dataFinal: dataFinal || undefined,
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

  const filtrosAtivos =
    Number(situacaoDocumento !== '') +
    Number(Boolean(prioridade)) +
    Number(Boolean(dataInicial) || Boolean(dataFinal));

  function limparFiltros() {
    setSituacaoDocumento('');
    setPrioridade('');
    setDataInicial('');
    setDataFinal('');
    setBusca('');
    setBuscaAtiva('');
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
    const sortavel: OSSortBy[] = [
      'numero',
      'clienteNome',
      'equipamentoDescricao',
      'dataAbertura',
      'situacaoDocumento',
      'prioridade',
      'faturamento',
    ];
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
    {
      key: 'numero',
      header: 'OS',
      mono: true,
      width: '76px',
      sortable: true,
      render: (os) => `#${os.numero}`,
    },
    {
      key: 'clienteCodigo',
      header: 'Cód. cliente',
      mono: true,
      width: '100px',
      render: (os) => os.clienteCodigo,
    },
    {
      key: 'clienteNome',
      header: 'Cliente',
      sortable: true,
      render: (os) => os.clienteNome ?? '—',
    },
    {
      key: 'veiculoCodigo',
      header: 'Cód. veículo',
      mono: true,
      width: '100px',
      render: (os) => os.equipamentoCodigo,
    },
    {
      key: 'equipamentoDescricao',
      header: 'Placa',
      mono: true,
      width: '110px',
      sortable: true,
      render: (os) => os.equipamentoDescricao ?? '—',
    },
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
      sortable: true,
      render: (os) => {
        const config =
          os.situacaoDocumento === undefined
            ? undefined
            : OS_DOCUMENT_STATUS_CONFIG[os.situacaoDocumento];
        return <Badge tone={config?.tone ?? 'neutral'}>{config?.label ?? 'Não informado'}</Badge>;
      },
    },
    {
      key: 'prioridade',
      header: 'Prioridade',
      width: '108px',
      sortable: true,
      render: (os) => <PriorityBadge priority={os.prioridade} />,
    },
    ...(canSeeFinancial
      ? [
          {
            key: 'faturamento',
            header: 'Valor',
            align: 'right' as const,
            mono: true,
            width: '128px',
            sortable: true,
            render: (os: OrdemServicoDTO) =>
              typeof os.faturamento === 'number' ? (
                <CurrencyCell
                  amount={new Intl.NumberFormat('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }).format(os.faturamento)}
                />
              ) : '—',
          },
        ]
      : []),
    {
      key: 'acoes',
      header: 'Ações',
      align: 'right' as const,
      width: `${48 + (podeEditar ? 44 : 0) + (podeDuplicar ? 44 : 0) + (podeExcluir ? 44 : 0)}px`,
      render: (os: OrdemServicoDTO) => (
        <div style={{ display: 'inline-flex', gap: 'var(--space-1)' }}>
          <PrintButton
            label={`Imprimir OS #${os.numero}`}
            onImprimir={() => baixarOSPdf(os.id, os.numero)}
          />
          {podeEditar && <EditButton to={`/os/${os.id}`} label={`Editar OS #${os.numero}`} />}
          {podeDuplicar && (
            <RowActionButton icon="copy" label={`Duplicar OS #${os.numero}`} onClick={() => setDuplicando(os)} />
          )}
          {osExcluivel(os) && (
            <RowActionButton icon="delete" tone="danger" label={`Excluir OS #${os.numero}`} onClick={() => setExcluindo(os)} />
          )}
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
              <span className={styles.desktopCreate}>
                <LinkButton to="/os/nova" size="sm">
                  <ActionIcon name="add" />
                  Nova OS
                </LinkButton>
              </span>
            )}
            <ExportButtons
              onExportarExcel={() =>
                baixarRelatorioOS(
                  {
                    ...periodoExportacaoPadrao(),
                    ...(dataInicial ? { dataInicial } : {}),
                    ...(dataFinal ? { dataFinal } : {}),
                    situacaoDocumento:
                      situacaoDocumento === '' ? undefined : Number(situacaoDocumento),
                    prioridade: prioridade || undefined,
                    busca: buscaAtiva || undefined,
                  },
                  'excel',
                )
              }
              onExportarPdf={() =>
                baixarRelatorioOS(
                  {
                    ...periodoExportacaoPadrao(),
                    ...(dataInicial ? { dataInicial } : {}),
                    ...(dataFinal ? { dataFinal } : {}),
                    situacaoDocumento:
                      situacaoDocumento === '' ? undefined : Number(situacaoDocumento),
                    prioridade: prioridade || undefined,
                    busca: buscaAtiva || undefined,
                  },
                  'pdf',
                )
              }
            />
          </>
        }
      />

      <form
        onSubmit={handleBuscar}
        className={styles.toolbar}
        aria-label="Filtros da lista de ordens de serviço"
      >
        <SearchInput
          placeholder="Buscar por Nº OS, cliente, código ou placa"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <ResponsiveFilters
          activeCount={filtrosAtivos}
          onClear={limparFiltros}
        >
          <Select
            label="Situação"
            placeholder="Todas as situações"
            value={situacaoDocumento}
            onChange={(e) => handleSituacaoDocumentoChange(e.target.value)}
            options={OS_DOCUMENT_STATUS_OPTIONS}
          />
          <Select
            className="os-priority-select"
            data-priority={prioridade || undefined}
            label="Prioridade"
            placeholder="Todas"
            value={prioridade}
            onChange={(e) => handlePrioridadeChange(e.target.value)}
            options={OS_PRIORIDADE_OPTIONS}
          />
          <Input
            type="date"
            label="Abertura de"
            value={dataInicial}
            max={dataFinal || undefined}
            onChange={(e) => {
              setDataInicial(e.target.value);
              setPage(1);
            }}
          />
          <Input
            type="date"
            label="Abertura até"
            value={dataFinal}
            min={dataInicial || undefined}
            onChange={(e) => {
              setDataFinal(e.target.value);
              setPage(1);
            }}
          />
        </ResponsiveFilters>
        <Button type="submit" variant="secondary">
          <ActionIcon name="search" />
          Buscar
        </Button>
      </form>

      {!isError && <ResultsSummary total={data?.total} />}

      <section className={styles.content} aria-live="polite">
        {isLoading && (
          <div className={styles.loading}>
            <Skeleton height={52} />
            <Skeleton height={52} />
            <Skeleton height={52} />
            <Skeleton height={52} />
          </div>
        )}

        {isError && (
          <ErrorState
            error={error}
            action={<Button onClick={() => refetch()}>Tentar de novo</Button>}
          />
        )}

        {!isLoading && !isError && data?.items.length === 0 && (
          <EmptyState
            title="Nenhuma OS encontrada"
            description="Ajuste os filtros ou crie uma nova OS."
            action={filtrosAtivos > 0 || buscaAtiva ? <Button variant="secondary" onClick={limparFiltros}>Limpar filtros</Button> : undefined}
          />
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
              renderMobileCard={(os) => {
                const status =
                  os.situacaoDocumento === undefined
                    ? undefined
                    : OS_DOCUMENT_STATUS_CONFIG[os.situacaoDocumento];
                return (
                  <MobileRecordCard
                    eyebrow={`OS #${os.numero}`}
                    title={os.clienteNome ?? `Cliente ${os.clienteCodigo}`}
                    subtitle={
                      os.equipamentoDescricao
                        ? `Placa ${os.equipamentoDescricao}`
                        : 'Veículo não informado'
                    }
                    status={
                      <Badge tone={status?.tone ?? 'neutral'}>
                        {status?.label ?? 'Não informado'}
                      </Badge>
                    }
                    fields={[
                      {
                        label: 'Abertura',
                        value: new Date(os.dataAbertura).toLocaleDateString('pt-BR'),
                        mono: true,
                      },
                      { label: 'Prioridade', value: <PriorityBadge priority={os.prioridade} /> },
                      ...(canSeeFinancial
                        ? [
                            {
                              label: 'Valor',
                              value:
                                typeof os.faturamento === 'number'
                                  ? formatMoney(os.faturamento)
                                  : '—',
                              mono: true,
                            },
                          ]
                        : []),
                    ]}
                    actions={
                      <>
                        <PrintButton
                          label={`Imprimir OS #${os.numero}`}
                          onImprimir={() => baixarOSPdf(os.id, os.numero)}
                        />
                        {podeEditar && (
                          <EditButton to={`/os/${os.id}`} label={`Editar OS #${os.numero}`} />
                        )}
                        {podeDuplicar && (
                          <RowActionButton icon="copy" label={`Duplicar OS #${os.numero}`} onClick={() => setDuplicando(os)} />
                        )}
                        {osExcluivel(os) && (
                          <RowActionButton icon="delete" tone="danger" label={`Excluir OS #${os.numero}`} onClick={() => setExcluindo(os)} />
                        )}
                      </>
                    }
                  />
                );
              }}
            />
            <div className={styles.pagination}>
              <Pagination
                page={page}
                limit={limit}
                total={data.total}
                onPageChange={setPage}
                onLimitChange={handleLimitChange}
              />
            </div>
          </>
        )}
      </section>
      {hasPermission('OS_CREATE') && <MobileFab to="/os/nova" label="Nova OS" />}

      <ConfirmDialog
        open={duplicando !== null}
        title={`Duplicar OS #${duplicando?.numero ?? ''}?`}
        description="Será criada uma OS nova e aberta, com número e DAV próprios, copiando cliente, veículo, problema, prioridade, produtos, serviços e diagnóstico. A OS original não é alterada."
        confirmLabel="Duplicar"
        loading={duplicarMutation.isPending}
        onCancel={() => setDuplicando(null)}
        onConfirm={() => duplicando && duplicarMutation.mutate(duplicando)}
      />
      <ReasonDialog
        open={excluindo !== null}
        title={`Excluir OS #${excluindo?.numero ?? ''}?`}
        description="A OS inteira será removida do sistema e do CHERP. Só OS em aberto pode ser excluída."
        reasonLabel="Motivo da exclusão"
        confirmLabel="Excluir OS"
        loading={excluirMutation.isPending}
        onCancel={() => setExcluindo(null)}
        onConfirm={(motivo) => excluindo && excluirMutation.mutate({ os: excluindo, motivo })}
      />
    </div>
  );
}
