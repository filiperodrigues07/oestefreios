import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { searchClientes, type ClienteSortBy } from '../api/clientes.api.js';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LinkButton,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  Skeleton,
  Table,
  type TableColumn,
} from '../components/ui/index.js';
import { hasPermission } from '../store/authStore.js';
import type { ClienteDTO, TipoPessoa } from '../types/cherp.types.js';
import styles from './ClientesPage.module.css';

const UF_OPTIONS = [
  { value: '', label: 'Todas' },
  ...['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR',
    'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'].map((uf) => ({ value: uf, label: uf })),
];

const TIPO_PESSOA_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'PJ', label: 'Pessoa Jurídica' },
  { value: 'PF', label: 'Pessoa Física' },
];

const SORTAVEIS: ClienteSortBy[] = ['codigo', 'nome', 'documento', 'telefone', 'cidade'];

export function ClientesPage() {
  const [searchParams] = useSearchParams();
  const initialBusca = searchParams.get('busca') ?? '';
  const [busca, setBusca] = useState(initialBusca);
  const [buscaAtiva, setBuscaAtiva] = useState(initialBusca);
  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoa | ''>('');
  const [uf, setUf] = useState('');
  const [sortBy, setSortBy] = useState<ClienteSortBy | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  const podeCriar = hasPermission('OS_CREATE');
  const podeEditar = hasPermission('OS_EDIT');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['clientes', buscaAtiva, page, tipoPessoa, uf, sortBy, sortOrder],
    queryFn: () =>
      searchClientes(buscaAtiva, page, 20, {
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
    { key: 'codigo', header: 'Código', render: (c) => c.codigo, mono: true, width: '92px', sortable: true },
    { key: 'nome', header: 'Nome / Razão Social', render: (c) => c.nome, sortable: true },
    { key: 'documento', header: 'CNPJ/CPF', render: (c) => c.documento ?? '—', mono: true, width: '140px', sortable: true },
    { key: 'telefone', header: 'Telefone', render: (c) => c.telefone ?? '—', mono: true, width: '128px', sortable: true },
    {
      key: 'cidade',
      header: 'Cidade/UF',
      width: '180px',
      sortable: true,
      render: (c) => (c.cidade ? `${c.cidade}/${c.uf ?? ''}` : '—'),
    },
    {
      key: 'acoes',
      header: '',
      align: 'right',
      width: '84px',
      render: (c) =>
        podeEditar ? (
          <LinkButton to={`/clientes/${c.codigo}/editar`} size="sm" variant="secondary">
            Editar
          </LinkButton>
        ) : null,
    },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        title="Clientes"
        description="Gerencie os cadastros e consulte os dados vinculados à oficina."
        actions={podeCriar ? <LinkButton to="/clientes/novo">+ Novo cliente</LinkButton> : undefined}
      />

      {data && !isLoading && !isError && (
        <p className={styles.total}>
          <strong>{data.total.toLocaleString('pt-BR')}</strong> {data.total === 1 ? 'registro' : 'registros'}
        </p>
      )}

      <form onSubmit={handleBuscar} className={styles.searchForm}>
        <SearchInput
          placeholder="Buscar por nome, razão social, código, CNPJ/CPF ou telefone"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <Select
          options={TIPO_PESSOA_OPTIONS}
          value={tipoPessoa}
          onChange={(e) => {
            setTipoPessoa(e.target.value as TipoPessoa | '');
            handleFiltroChange();
          }}
        />
        <Select
          options={UF_OPTIONS}
          value={uf}
          onChange={(e) => {
            setUf(e.target.value);
            handleFiltroChange();
          }}
        />
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

      {isLoading && (
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <Skeleton height={40} />
          <Skeleton height={40} />
          <Skeleton height={40} />
        </Card>
      )}

      {isError && <ErrorState action={<Button onClick={() => refetch()}>Tentar de novo</Button>} />}

      {!isLoading && !isError && data && data.items.length === 0 && (
        <EmptyState title="Nenhum cliente cadastrado ainda" />
      )}

      {!isLoading && !isError && data && data.items.length > 0 && (
        <>
          <Table
            columns={columns}
            data={data.items}
            rowKey={(c) => c.codigo}
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
