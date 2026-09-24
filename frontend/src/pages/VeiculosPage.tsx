import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { getClienteByCodigo } from '../api/clientes.api.js';
import { excluirEquipamento, listarEquipamentos, type EquipamentoSortBy } from '../api/equipamentos.api.js';
import { baixarRelatorioVeiculos } from '../api/relatorios.api.js';
import { ClienteSearch } from '../components/search/ClienteSearch.js';
import { VeiculoFormModal } from '../components/veiculos/VeiculoFormModal.js';
import { readStoredFilters, writeStoredFilters } from '../utils/filterStorage.js';
import {
  ActionIcon,
  Button,
  Card,
  EmptyState,
  ErrorState,
  ExportButtons,
  PageHeader,
  MobileRecordCard,
  MobileFab,
  ExcluirCadastroDialog,
  Pagination,
  ResponsiveFilters,
  ResultsSummary,
  RowActionButton,
  SearchInput,
  Select,
  Skeleton,
  Table,
  type TableColumn,
  useToast,
} from '../components/ui/index.js';
import { hasPermission } from '../store/authStore.js';
import type { ClienteDTO, EquipamentoDTO } from '../types/cherp.types.js';
import styles from './VeiculosPage.module.css';

export function VeiculosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filtrosSalvos = readStoredFilters('veiculos');
  const initialBusca = searchParams.get('busca') ?? filtrosSalvos.get('busca') ?? '';
  const initialClienteCodigo = searchParams.get('clienteCodigo') ?? filtrosSalvos.get('clienteCodigo') ?? '';
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const podeExcluir = hasPermission('VEHICLE_DELETE');
  const [excluindo, setExcluindo] = useState<EquipamentoDTO | null>(null);
  const [busca, setBusca] = useState(initialBusca);
  const [buscaAtiva, setBuscaAtiva] = useState(initialBusca);
  const [cliente, setCliente] = useState<ClienteDTO | null>(null);
  const [anoFabricacao, setAnoFabricacao] = useState(() => searchParams.get('anoFabricacao') ?? filtrosSalvos.get('anoFabricacao') ?? '');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [sortBy, setSortBy] = useState<EquipamentoSortBy>('descricao');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [modal, setModal] = useState<{ veiculo?: EquipamentoDTO } | null>(null);

  // A URL só guarda o código do cliente filtrado — reidrata o objeto completo (pro nome aparecer
  // no chip do filtro) buscando uma vez ao montar, se a tela foi aberta com ?clienteCodigo= na URL.
  const { data: clienteDaUrl } = useQuery({
    queryKey: ['cliente', initialClienteCodigo],
    queryFn: () => getClienteByCodigo(initialClienteCodigo),
    enabled: Boolean(initialClienteCodigo),
  });
  useEffect(() => {
    if (clienteDaUrl) setCliente(clienteDaUrl);
  }, [clienteDaUrl]);

  // Filtros salvos na URL (compartilhável, funciona com voltar do navegador) e em sessionStorage
  // (sobrevive a navegar pra outra tela pelo menu, que troca de rota sem manter query string).
  // `replace` pra não empilhar histórico a cada tecla/seleção.
  useEffect(() => {
    const params = new URLSearchParams();
    if (buscaAtiva) params.set('busca', buscaAtiva);
    if (cliente?.codigo) params.set('clienteCodigo', cliente.codigo);
    if (anoFabricacao) params.set('anoFabricacao', anoFabricacao);
    setSearchParams(params, { replace: true });
    writeStoredFilters('veiculos', params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscaAtiva, cliente?.codigo, anoFabricacao]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['equipamentos', 'lista', buscaAtiva, cliente?.codigo, anoFabricacao, page, limit, sortBy, sortOrder],
    queryFn: () => listarEquipamentos(buscaAtiva, page, limit, cliente?.codigo, sortBy, sortOrder, anoFabricacao ? Number(anoFabricacao) : undefined),
  });
  const filtrosAtivos = Number(Boolean(cliente)) + Number(Boolean(anoFabricacao));

  function limparFiltros() {
    setCliente(null);
    setAnoFabricacao('');
    setBusca('');
    setBuscaAtiva('');
    setPage(1);
  }

  function handleSortChange(key: string) {
    if (!['codigo', 'identificacao', 'descricao', 'ano', 'cliente'].includes(key)) return;
    if (key === sortBy) setSortOrder((value) => value === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key as EquipamentoSortBy); setSortOrder('asc'); }
    setPage(1);
  }
  const columns: TableColumn<EquipamentoDTO>[] = [
    { key: 'codigo', header: 'Código', mono: true, width: '92px', sortable: true, render: (v) => v.codigo },
    { key: 'identificacao', header: 'Placa', mono: true, sortable: true, render: (v) => v.identificacao || '—' },
    { key: 'descricao', header: 'Marca / Modelo', sortable: true, render: (v) => v.descricao },
    {
      key: 'ano',
      header: 'Ano fab. / mod.',
      sortable: true,
      render: (v) => `${v.anoFabricacao || '—'} / ${v.anoModelo || '—'}`,
    },
    {
      key: 'cliente',
      header: 'Cliente',
      sortable: true,
      render: (v) =>
        v.clienteNome
          ? `${v.clienteNome} (${v.clienteCodigo})`
          : v.clienteCodigo || 'Sem cliente vinculado',
    },
    {
      key: 'acoes',
      header: 'Ações',
      align: 'right',
      render: (v) => (
        <span style={{ display: 'inline-flex', gap: 'var(--space-1)' }}>
          {hasPermission('OS_EDIT') && (
            <Button
              variant="secondary"
              size="sm"
              className={styles.editButton}
              onClick={(event) => {
                event.stopPropagation();
                setModal({ veiculo: v });
              }}
              aria-label={`Editar veículo ${v.identificacao || v.codigo}`}
              title={`Editar veículo ${v.identificacao || v.codigo}`}
            >
              <ActionIcon name="edit" />
            </Button>
          )}
          {podeExcluir && (
            <RowActionButton icon="delete" tone="danger" label={`Excluir veículo ${v.identificacao || v.codigo}`} onClick={() => setExcluindo(v)} />
          )}
        </span>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        title="Veículos"
        description="Consulte os veículos ativos e seus clientes vinculados."
        actions={
          <>
            {hasPermission('OS_CREATE') && (
              <span className={styles.desktopCreate}>
                <Button onClick={() => setModal({})}>
                  <ActionIcon name="add" />
                  Novo veículo
                </Button>
              </span>
            )}
            <ExportButtons
              onExportarExcel={() =>
                baixarRelatorioVeiculos(
                  { busca: buscaAtiva || undefined, clienteCodigo: cliente?.codigo, anoFabricacao: anoFabricacao ? Number(anoFabricacao) : undefined },
                  'excel',
                )
              }
              onExportarPdf={() =>
                baixarRelatorioVeiculos(
                  { busca: buscaAtiva || undefined, clienteCodigo: cliente?.codigo, anoFabricacao: anoFabricacao ? Number(anoFabricacao) : undefined },
                  'pdf',
                )
              }
            />
          </>
        }
      />
      <form
        className={styles.searchForm}
        onSubmit={(event) => {
          event.preventDefault();
          setBuscaAtiva(busca.trim());
          setPage(1);
        }}
      >
        <SearchInput
          aria-label="Buscar por placa, marca ou modelo"
          placeholder="Buscar por placa, marca ou modelo"
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
        />
        <ResponsiveFilters activeCount={filtrosAtivos} onClear={limparFiltros}>
          <div className={styles.clientFilter}>
            {cliente ? (
              <>
                <span>Cliente: <strong>{cliente.nome}</strong></span>
                <Button type="button" variant="secondary" onClick={() => { setCliente(null); setPage(1); }}>Limpar cliente</Button>
              </>
            ) : (
              <ClienteSearch label="Filtrar por cliente" onSelect={(value) => { setCliente(value); setPage(1); }} />
            )}
          </div>
          <Select
            label="Ano de fabricação"
            value={anoFabricacao}
            onChange={(event) => { setAnoFabricacao(event.target.value); setPage(1); }}
            options={[{ value: '', label: 'Todos' }, ...Array.from({ length: new Date().getFullYear() - 1969 }, (_, index) => { const year = new Date().getFullYear() - index; return { value: String(year), label: String(year) }; })]}
          />
        </ResponsiveFilters>
        <Button type="submit" variant="secondary">
          <ActionIcon name="search" />
          Buscar
        </Button>
      </form>
      {!isError && <ResultsSummary total={data?.total} />}
      {isLoading && (
        <Card>
          <Skeleton height={200} />
        </Card>
      )}
      {isError && (
        <ErrorState
          error={error}
          action={<Button onClick={() => refetch()}>Tentar de novo</Button>}
        />
      )}
      {!isLoading && !isError && data && (
        <>
          {data.items.length === 0 ? (
            <EmptyState
              title="Nenhum veículo encontrado"
              description={filtrosAtivos > 0 || buscaAtiva ? 'Não encontramos resultados com os filtros atuais.' : undefined}
              action={filtrosAtivos > 0 || buscaAtiva ? <Button variant="secondary" onClick={limparFiltros}>Limpar filtros</Button> : undefined}
            />
          ) : (
            <>
              <Table
                columns={columns}
                data={data.items}
                rowKey={(v) => v.codigo}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={handleSortChange}
                columnPrefsKey="veiculos"
                renderMobileCard={(veiculo) => (
                  <MobileRecordCard
                    eyebrow={veiculo.identificacao || `Veículo ${veiculo.codigo}`}
                    title={veiculo.descricao}
                    subtitle={veiculo.clienteNome ?? `Cliente ${veiculo.clienteCodigo}`}
                    fields={[
                      { label: 'Ano fabricação', value: veiculo.anoFabricacao || '—', mono: true },
                      { label: 'Ano modelo', value: veiculo.anoModelo || '—', mono: true },
                    ]}
                    actions={
                      hasPermission('OS_EDIT') || podeExcluir ? (
                        <>
                          {hasPermission('OS_EDIT') && (
                            <Button variant="secondary" size="sm" className={styles.editButton} onClick={() => setModal({ veiculo })} aria-label={`Editar veículo ${veiculo.identificacao || veiculo.codigo}`} title={`Editar veículo ${veiculo.identificacao || veiculo.codigo}`}>
                              <ActionIcon name="edit" />
                            </Button>
                          )}
                          {podeExcluir && (
                            <RowActionButton icon="delete" tone="danger" label={`Excluir veículo ${veiculo.identificacao || veiculo.codigo}`} onClick={() => setExcluindo(veiculo)} />
                          )}
                        </>
                      ) : undefined
                    }
                  />
                )}
              />
              <div className={styles.pagination}>
                <Pagination
                  page={data.page}
                  limit={data.limit}
                  total={data.total}
                  onPageChange={setPage}
                  onLimitChange={(value) => {
                    setLimit(value);
                    setPage(1);
                  }}
                />
              </div>
            </>
          )}
        </>
      )}
      {modal && (
        <VeiculoFormModal
          open
          veiculo={modal.veiculo}
          onClose={() => setModal(null)}
          onCreated={() => {
            setModal(null);
            void queryClient.invalidateQueries({
              predicate: (query) => String(query.queryKey[0]).startsWith('equipamento'),
            });
          }}
        />
      )}
      {excluindo && (
        <ExcluirCadastroDialog
          tipo="veículo"
          nome={excluindo.identificacao || excluindo.descricao}
          onExcluir={(motivo) => excluirEquipamento(excluindo.codigo, motivo)}
          onClose={() => setExcluindo(null)}
          onExcluido={() => {
            showToast('Veículo excluído.', 'success');
            setExcluindo(null);
            void queryClient.invalidateQueries({
              predicate: (query) => String(query.queryKey[0]).startsWith('equipamento'),
            });
          }}
        />
      )}
      {hasPermission('OS_CREATE') && (
        <MobileFab label="Novo veículo" onClick={() => setModal({})} />
      )}
    </div>
  );
}
