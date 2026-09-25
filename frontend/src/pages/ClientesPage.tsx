import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { excluirCliente, searchClientes, type ClienteSortBy } from '../api/clientes.api.js';
import { baixarRelatorioClientes } from '../api/relatorios.api.js';
import {
  ActionIcon,
  Button,
  Card,
  EditButton,
  EmptyState,
  ErrorState,
  ExcluirCadastroDialog,
  ExportButtons,
  LinkButton,
  MobileRecordCard,
  MobileFab,
  PageHeader,
  Pagination,
  SearchInput,
  ResponsiveFilters,
  ResultsSummary,
  RowActionButton,
  Select,
  Skeleton,
  Table,
  type TableColumn,
  useToast,
} from '../components/ui/index.js';
import { hasPermission } from '../store/authStore.js';
import type { ClienteDTO, TipoPessoa } from '../types/cherp.types.js';
import { readStoredFilters, writeStoredFilters } from '../utils/filterStorage.js';
import styles from './ClientesPage.module.css';

const UF_OPTIONS = [
  { value: '', label: 'Todas' },
  ...[
    'AC',
    'AL',
    'AP',
    'AM',
    'BA',
    'CE',
    'DF',
    'ES',
    'GO',
    'MA',
    'MT',
    'MS',
    'MG',
    'PA',
    'PB',
    'PR',
    'PE',
    'PI',
    'RJ',
    'RN',
    'RS',
    'RO',
    'RR',
    'SC',
    'SP',
    'SE',
    'TO',
  ].map((uf) => ({ value: uf, label: uf })),
];

const TIPO_PESSOA_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'PJ', label: 'Pessoa Jurídica' },
  { value: 'PF', label: 'Pessoa Física' },
];

const SORTAVEIS: ClienteSortBy[] = ['codigo', 'nome', 'documento', 'telefone', 'cidade'];

export function ClientesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filtrosSalvos = readStoredFilters('clientes');
  const initialBusca = searchParams.get('busca') ?? filtrosSalvos.get('busca') ?? '';
  const [busca, setBusca] = useState(initialBusca);
  const [buscaAtiva, setBuscaAtiva] = useState(initialBusca);
  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoa | ''>(() => {
    const value = searchParams.get('tipoPessoa') ?? filtrosSalvos.get('tipoPessoa');
    return value === 'PJ' || value === 'PF' ? value : '';
  });
  const [uf, setUf] = useState(() => {
    const value = searchParams.get('uf') ?? filtrosSalvos.get('uf') ?? '';
    return UF_OPTIONS.some((o) => o.value === value) ? value : '';
  });
  const [sortBy, setSortBy] = useState<ClienteSortBy | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const podeCriar = hasPermission('OS_CREATE');
  const podeEditar = hasPermission('OS_EDIT');
  const podeExcluir = hasPermission('CLIENT_DELETE');
  const navigate = useNavigate();
  const [excluindo, setExcluindo] = useState<ClienteDTO | null>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  // Filtros salvos na URL (compartilhável, funciona com voltar do navegador) e em sessionStorage
  // (sobrevive a navegar pra outra tela pelo menu, que troca de rota sem manter query string).
  // `replace` pra não empilhar histórico a cada tecla/seleção.
  useEffect(() => {
    const params = new URLSearchParams();
    if (buscaAtiva) params.set('busca', buscaAtiva);
    if (tipoPessoa) params.set('tipoPessoa', tipoPessoa);
    if (uf) params.set('uf', uf);
    setSearchParams(params, { replace: true });
    writeStoredFilters('clientes', params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscaAtiva, tipoPessoa, uf]);

  const { data, isLoading, isPlaceholderData, isError, error, refetch } = useQuery({
    placeholderData: keepPreviousData,
    queryKey: ['clientes', buscaAtiva, page, limit, tipoPessoa, uf, sortBy, sortOrder],
    queryFn: () =>
      searchClientes(buscaAtiva, page, limit, {
        tipoPessoa: tipoPessoa || undefined,
        uf: uf || undefined,
        sortBy,
        sortOrder,
      }),
  });

  function handleBuscar(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setBuscaAtiva(busca.trim());
  }

  function handleFiltroChange() {
    setPage(1);
  }

  const filtrosAtivos = Number(Boolean(tipoPessoa)) + Number(Boolean(uf));

  function limparFiltros() {
    setTipoPessoa('');
    setUf('');
    setBusca('');
    setBuscaAtiva('');
    setPage(1);
  }

  function handleLimitChange(novoLimit: number) {
    setLimit(novoLimit);
    setPage(1);
  }

  function handleSortChange(key: string) {
    if (!SORTAVEIS.includes(key as ClienteSortBy)) return;
    if (key === sortBy) {
      setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key as ClienteSortBy);
      setSortOrder('asc');
    }
    setPage(1);
  }

  const columns: TableColumn<ClienteDTO>[] = [
    {
      key: 'codigo',
      header: 'Código',
      render: (c) => c.codigo,
      mono: true,
      width: '92px',
      sortable: true,
    },
    { key: 'nome', header: 'Nome / Razão Social', render: (c) => c.nome, sortable: true },
    {
      key: 'documento',
      header: 'CNPJ/CPF',
      render: (c) => c.documento ?? '—',
      mono: true,
      width: '168px',
      sortable: true,
    },
    {
      key: 'telefone',
      header: 'Telefone',
      render: (c) => c.telefone ?? '—',
      mono: true,
      width: '148px',
      sortable: true,
    },
    {
      key: 'cidade',
      header: 'Cidade/UF',
      width: '180px',
      sortable: true,
      render: (c) => (c.cidade ? `${c.cidade}/${c.uf ?? ''}` : '—'),
    },
    {
      key: 'acoes',
      header: 'Ações',
      align: 'right',
      width: podeEditar && podeExcluir ? '104px' : '56px',
      render: (c) => (
        <span style={{ display: 'inline-flex', gap: 'var(--space-1)' }}>
          {podeEditar && <EditButton to={`/clientes/${c.codigo}/editar`} label={`Editar ${c.nome}`} />}
          {podeExcluir && <RowActionButton icon="delete" tone="danger" label={`Excluir ${c.nome}`} onClick={() => setExcluindo(c)} />}
        </span>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        title="Clientes"
        description="Gerencie os cadastros e consulte os dados vinculados à oficina."
        actions={
          <>
            {podeCriar && (
              <span className={styles.desktopCreate}>
                <LinkButton to="/clientes/novo">
                  <ActionIcon name="add" />
                  Novo cliente
                </LinkButton>
              </span>
            )}
            <ExportButtons
              onExportarExcel={() =>
                baixarRelatorioClientes(
                  {
                    tipoPessoa: tipoPessoa || undefined,
                    uf: uf || undefined,
                    busca: buscaAtiva || undefined,
                  },
                  'excel',
                )
              }
              onExportarPdf={() =>
                baixarRelatorioClientes(
                  {
                    tipoPessoa: tipoPessoa || undefined,
                    uf: uf || undefined,
                    busca: buscaAtiva || undefined,
                  },
                  'pdf',
                )
              }
            />
          </>
        }
      />

      <form onSubmit={handleBuscar} className={styles.searchForm}>
        <SearchInput
          placeholder="Buscar por nome, razão social, código, CNPJ/CPF ou telefone"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <ResponsiveFilters
          activeCount={filtrosAtivos}
          onClear={limparFiltros}
        >
          <Select
            label="Tipo de pessoa"
            options={TIPO_PESSOA_OPTIONS}
            value={tipoPessoa}
            onChange={(e) => {
              setTipoPessoa(e.target.value as TipoPessoa | '');
              handleFiltroChange();
            }}
          />
          <Select
            label="UF"
            options={UF_OPTIONS}
            value={uf}
            onChange={(e) => {
              setUf(e.target.value);
              handleFiltroChange();
            }}
          />
        </ResponsiveFilters>
        <Button type="submit" variant="secondary">
          <ActionIcon name="search" />
          Buscar
        </Button>
      </form>

      {!isError && <ResultsSummary total={data?.total} />}

      {isLoading && (
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <Skeleton height={40} />
          <Skeleton height={40} />
          <Skeleton height={40} />
        </Card>
      )}

      {isError && (
        <ErrorState
          error={error}
          action={<Button onClick={() => refetch()}>Tentar de novo</Button>}
        />
      )}

      {!isLoading && !isError && data && data.items.length === 0 && (
        <EmptyState
          title={filtrosAtivos > 0 || buscaAtiva ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado ainda'}
          description={
            buscaAtiva
              ? 'A busca procura por nome, código, CPF/CNPJ ou telefone. Confira a digitação ou limpe os filtros.'
              : filtrosAtivos > 0
                ? 'Não encontramos resultados com os filtros atuais.'
                : undefined
          }
          action={
            filtrosAtivos > 0 || buscaAtiva ? (
              <Button variant="secondary" onClick={limparFiltros}>Limpar filtros</Button>
            ) : podeCriar ? (
              <LinkButton to="/clientes/novo">Cadastrar cliente</LinkButton>
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
            rowKey={(c) => c.codigo}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
            columnPrefsKey="clientes"
            onRowClick={podeEditar ? (c) => navigate(`/clientes/${c.codigo}/editar`) : undefined}
            renderMobileCard={(cliente) => (
              <MobileRecordCard
                eyebrow={`Cliente ${cliente.codigo}`}
                title={cliente.nome}
                subtitle={cliente.documento ?? 'Documento não informado'}
                fields={[
                  {
                    label: 'Telefone',
                    value: cliente.telefone ?? cliente.celular ?? 'Não informado',
                    mono: true,
                  },
                  {
                    label: 'Cidade / UF',
                    value: cliente.cidade
                      ? `${cliente.cidade}/${cliente.uf ?? ''}`
                      : 'Não informado',
                  },
                ]}
                actions={
                  podeEditar || podeExcluir ? (
                    <>
                      {podeEditar && (
                        <EditButton
                          to={`/clientes/${cliente.codigo}/editar`}
                          label={`Editar ${cliente.nome}`}
                        />
                      )}
                      {podeExcluir && (
                        <RowActionButton icon="delete" tone="danger" label={`Excluir ${cliente.nome}`} onClick={() => setExcluindo(cliente)} />
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
              onLimitChange={handleLimitChange}
            />
          </div>
        </>
      )}
      {excluindo && (
        <ExcluirCadastroDialog
          tipo="cliente"
          nome={excluindo.nome}
          onExcluir={(motivo) => excluirCliente(excluindo.codigo, motivo)}
          onClose={() => setExcluindo(null)}
          onExcluido={() => {
            showToast(`Cliente ${excluindo.nome} excluído.`, 'success');
            setExcluindo(null);
            void queryClient.invalidateQueries({ queryKey: ['clientes'] });
          }}
        />
      )}
      {podeCriar && <MobileFab to="/clientes/novo" label="Novo cliente" />}
    </div>
  );
}
