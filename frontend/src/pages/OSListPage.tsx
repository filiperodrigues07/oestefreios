import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { prefetchOS } from '../routes/prefetch.js';
import { baixarOSPdf, duplicarOS, excluirOS, listarOS, type OsMessageChannel, type OSSortBy } from '../api/os.api.js';
import { OSMessageDialog } from '../components/os/OSMessageDialog.js';
import { getUserErrorMessage } from '../utils/errorPresentation.js';
import { handleMutationError } from '../pwa/offlineErrorToast.js';
import { baixarRelatorioOS } from '../api/relatorios.api.js';
import { CurrencyCell } from '../components/ui/CurrencyCell.js';
import {
  OS_DOCUMENT_STATUS_CONFIG,
  OS_DOCUMENT_STATUS_OPTIONS,
  OS_PRIORIDADE_OPTIONS,
  SITUACAO_ATENDIMENTO_CONFIG,
  SITUACAO_ATENDIMENTO_CURTA,
  SITUACAO_ATENDIMENTO_OPTIONS,
  SITUACAO_FINALIZADA_APP,
  situacaoDaOS,
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
  ReasonDialog,
  RefreshButton,
  RowActionsMenu,
  type RowActionItem,
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
    initialSituacaoDocumento === '' ||
    (initialSituacaoDocumento === SITUACAO_FINALIZADA_APP && hasPermission('OS_VIEW_FINALIZADAS')) ||
    (initialSituacaoDocumento !== null && OS_DOCUMENT_STATUS_CONFIG[Number(initialSituacaoDocumento)])
      ? initialSituacaoDocumento
      : '0',
  );
  const [prioridade, setPrioridade] = useState<OSPrioridade | ''>(() => {
    const value = searchParams.get('prioridade') ?? filtrosSalvos.get('prioridade');
    return value && OS_PRIORIDADE_OPTIONS.some((o) => o.value === value) ? (value as OSPrioridade) : '';
  });
  const [situacaoAtendimento, setSituacaoAtendimento] = useState(() => {
    const value = searchParams.get('situacaoAtendimento') ?? filtrosSalvos.get('situacaoAtendimento');
    return value && SITUACAO_ATENDIMENTO_CONFIG[value] ? value : '';
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
  const podeVerFinalizadas = hasPermission('OS_VIEW_FINALIZADAS');
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [duplicando, setDuplicando] = useState<OrdemServicoDTO | null>(null);
  const [excluindo, setExcluindo] = useState<OrdemServicoDTO | null>(null);
  const [enviando, setEnviando] = useState<{ os: OrdemServicoDTO; canal: OsMessageChannel } | null>(null);
  const podeEnviar = hasPermission('OS_CHANGE_STATUS');

  // Coluna Ações = lápis + "⋯": imprimir, enviar e gerenciar ficam no menu, a coluna não cresce a cada ação nova.
  const acoesDaOS = (os: OrdemServicoDTO): RowActionItem[] => [
    { key: 'print', label: 'Imprimir / baixar PDF', icon: 'print', onSelect: () => baixarOSPdf(os.id, os.numero).catch((err: unknown) => {
      showToast(getUserErrorMessage(err, 'Não foi possível gerar o PDF.'), 'danger');
    }) },
    ...(podeEnviar
      ? [
          { key: 'whatsapp', label: 'Enviar por WhatsApp', icon: 'whatsapp' as const, onSelect: () => setEnviando({ os, canal: 'whatsapp' }) },
          { key: 'email', label: 'Enviar por e-mail', icon: 'mail' as const, onSelect: () => setEnviando({ os, canal: 'email' }) },
        ]
      : []),
    ...(podeDuplicar ? [{ key: 'duplicate', label: 'Duplicar OS', icon: 'copy' as const, separar: true, onSelect: () => setDuplicando(os) }] : []),
    ...(osExcluivel(os)
      ? [{ key: 'delete', label: 'Excluir OS', icon: 'delete' as const, danger: true, separar: !podeDuplicar, onSelect: () => setExcluindo(os) }]
      : []),
  ];

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
    if (situacaoAtendimento) params.set('situacaoAtendimento', situacaoAtendimento);
    if (dataInicial) params.set('dataInicial', dataInicial);
    if (dataFinal) params.set('dataFinal', dataFinal);
    if (buscaAtiva) params.set('busca', buscaAtiva);
    setSearchParams(params, { replace: true });
    writeStoredFilters('os', params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [situacaoDocumento, prioridade, situacaoAtendimento, dataInicial, dataFinal, buscaAtiva]);

  const { data, isLoading, isFetching, isPlaceholderData, isError, error, refetch } = useQuery({
    // Troca de página/filtro mantém a lista anterior na tela (sem skeleton piscando) até a nova chegar.
    placeholderData: keepPreviousData,
    // Vários aparelhos na oficina: a lista se atualiza sozinha (só com a aba visível) e ao voltar pra aba.
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
    queryKey: [
      'os-list',
      situacaoDocumento,
      prioridade,
      situacaoAtendimento,
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
        situacaoDocumento: situacaoDocumento === '' || situacaoDocumento === SITUACAO_FINALIZADA_APP ? undefined : Number(situacaoDocumento),
        somenteFinalizadasApp: situacaoDocumento === SITUACAO_FINALIZADA_APP,
        incluirFinalizadas: true,
        prioridade: prioridade || undefined,
        situacaoAtendimento: situacaoAtendimento || undefined,
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
    Number(Boolean(situacaoAtendimento)) +
    Number(Boolean(dataInicial) || Boolean(dataFinal));

  function limparFiltros() {
    setSituacaoDocumento('');
    setPrioridade('');
    setSituacaoAtendimento('');
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

  function handleSituacaoAtendimentoChange(value: string) {
    setSituacaoAtendimento(value);
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
      width: '68px',
      sortable: true,
      render: (os) => `#${os.numero}`,
    },
    {
      key: 'clienteCodigo',
      header: 'Cód. cli.',
      mono: true,
      width: '82px',
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
      header: 'Cód. veíc.',
      mono: true,
      width: '86px',
      render: (os) => os.equipamentoCodigo,
    },
    {
      key: 'equipamentoDescricao',
      header: 'Placa',
      mono: true,
      width: '96px',
      sortable: true,
      render: (os) => os.equipamentoDescricao ?? '—',
    },
    {
      key: 'dataAbertura',
      header: 'Abertura',
      mono: true,
      width: '98px',
      sortable: true,
      render: (os) => new Date(os.dataAbertura).toLocaleDateString('pt-BR'),
    },
    {
      key: 'situacaoDocumento',
      header: 'Status',
      width: '112px',
      sortable: true,
      render: (os) => {
        const config = situacaoDaOS(os);
        return <Badge tone={config?.tone ?? 'neutral'}>{config?.label ?? 'Não informado'}</Badge>;
      },
    },
    {
      key: 'situacaoAtendimento',
      header: 'Sit. atend.',
      width: '124px',
      render: (os) => {
        const codigo = os.situacaoAtendimentoCodigo;
        const config = codigo ? SITUACAO_ATENDIMENTO_CONFIG[codigo] : undefined;
        if (!config) return <span aria-label="Não informada">—</span>;
        return <span title={config.label}><Badge tone={config.tone}>{SITUACAO_ATENDIMENTO_CURTA[codigo!] ?? config.label}</Badge></span>;
      },
    },
    {
      key: 'prioridade',
      header: 'Prioridade',
      width: '100px',
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
      width: `${podeEditar ? 104 : 64}px`,
      render: (os: OrdemServicoDTO) => (
        <div style={{ display: 'inline-flex', gap: 'var(--space-1)' }}>
          {podeEditar && <EditButton to={`/os/${os.id}`} label={`Editar OS #${os.numero}`} />}
          <RowActionsMenu label={`Ações da OS #${os.numero}`} items={acoesDaOS(os)} />
        </div>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        title="Ordens de Serviço"
        description="Consulte as ordens e o status do documento registrado no CHERP."
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
                      situacaoDocumento === '' || situacaoDocumento === SITUACAO_FINALIZADA_APP ? undefined : Number(situacaoDocumento),
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
                      situacaoDocumento === '' || situacaoDocumento === SITUACAO_FINALIZADA_APP ? undefined : Number(situacaoDocumento),
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
          {/* Sem OS_VIEW_FINALIZADAS a lista já vem só com OS em aberto: filtro de situação não se aplica. */}
          {podeVerFinalizadas && (
            <Select
              label="Status"
              placeholder="Todos os status"
              value={situacaoDocumento}
              onChange={(e) => handleSituacaoDocumentoChange(e.target.value)}
              options={[
                ...OS_DOCUMENT_STATUS_OPTIONS.slice(0, 1),
                { value: SITUACAO_FINALIZADA_APP, label: 'Finalizada no app' },
                ...OS_DOCUMENT_STATUS_OPTIONS.slice(1),
              ]}
            />
          )}
          <Select
            label="Sit. atendimento"
            placeholder="Todas"
            value={situacaoAtendimento}
            onChange={(e) => handleSituacaoAtendimentoChange(e.target.value)}
            options={SITUACAO_ATENDIMENTO_OPTIONS}
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
            title={filtrosAtivos > 0 || buscaAtiva ? 'Nenhuma OS encontrada' : 'Nenhuma OS ainda'}
            description={
              buscaAtiva
                ? 'A busca procura por número da OS, cliente, placa ou veículo. Confira a digitação ou limpe os filtros.'
                : filtrosAtivos > 0
                  ? 'Nenhuma OS com esses filtros. Limpe os filtros para ver todas.'
                  : 'Quando uma OS for aberta, aqui ou no CHERP, ela aparece nesta lista.'
            }
            action={
              filtrosAtivos > 0 || buscaAtiva ? (
                <Button variant="secondary" onClick={limparFiltros}>Limpar filtros</Button>
              ) : hasPermission('OS_CREATE') ? (
                <LinkButton to="/os/nova">Abrir nova OS</LinkButton>
              ) : undefined
            }
          />
        )}

        {!isLoading && !isError && data && data.items.length > 0 && (
          <>
            <Table
              stale={isPlaceholderData}
              columns={columns}
              data={data.items}
              rowKey={(os) => os.id}
              onRowClick={(os) => navigate(`/os/${os.id}`)}
              onRowIntent={(os) => prefetchOS(os.id)}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={handleSortChange}
              columnPrefsKey="os"
              renderMobileCard={(os) => {
                const status = situacaoDaOS(os);
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
                      {
                        label: 'Sit. atendimento',
                        value: os.situacaoAtendimentoCodigo && SITUACAO_ATENDIMENTO_CONFIG[os.situacaoAtendimentoCodigo]
                          ? <Badge tone={SITUACAO_ATENDIMENTO_CONFIG[os.situacaoAtendimentoCodigo]!.tone}>{SITUACAO_ATENDIMENTO_CONFIG[os.situacaoAtendimentoCodigo]!.label}</Badge>
                          : '—',
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
                        {podeEditar && (
                          <EditButton to={`/os/${os.id}`} label={`Editar OS #${os.numero}`} />
                        )}
                        <RowActionsMenu label={`Ações da OS #${os.numero}`} items={acoesDaOS(os)} />
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
      {enviando && (
        <OSMessageDialog
          key={`${enviando.os.id}-${enviando.canal}`}
          id={enviando.os.id}
          channel={enviando.canal}
          defaultType={
            enviando.os.status === 'AGUARDANDO_CLIENTE' ? 'aguardando_cliente'
              : enviando.os.status === 'AGUARDANDO_PECA' ? 'aguardando_peca'
                : enviando.os.status === 'CONCLUIDA' ? 'pronta' : 'aberta'
          }
          onClose={() => setEnviando(null)}
        />
      )}
    </div>
  );
}
