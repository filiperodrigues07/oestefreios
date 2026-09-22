import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { listarEquipamentos, type EquipamentoSortBy } from '../api/equipamentos.api.js';
import { ClienteSearch } from '../components/search/ClienteSearch.js';
import { VeiculoFormModal } from '../components/veiculos/VeiculoFormModal.js';
import {
  ActionIcon,
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  MobileRecordCard,
  MobileFab,
  Pagination,
  ResponsiveFilters,
  SearchInput,
  Select,
  Skeleton,
  Table,
  type TableColumn,
} from '../components/ui/index.js';
import { hasPermission } from '../store/authStore.js';
import type { ClienteDTO, EquipamentoDTO } from '../types/cherp.types.js';
import styles from './VeiculosPage.module.css';

export function VeiculosPage() {
  const [searchParams] = useSearchParams();
  const initialBusca = searchParams.get('busca') ?? '';
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState(initialBusca);
  const [buscaAtiva, setBuscaAtiva] = useState(initialBusca);
  const [cliente, setCliente] = useState<ClienteDTO | null>(null);
  const [anoFabricacao, setAnoFabricacao] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [sortBy, setSortBy] = useState<EquipamentoSortBy>('descricao');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [modal, setModal] = useState<{ veiculo?: EquipamentoDTO } | null>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['equipamentos', 'lista', buscaAtiva, cliente?.codigo, anoFabricacao, page, limit, sortBy, sortOrder],
    queryFn: () => listarEquipamentos(buscaAtiva, page, limit, cliente?.codigo, sortBy, sortOrder, anoFabricacao ? Number(anoFabricacao) : undefined),
  });
  function handleSortChange(key: string) {
    if (!['identificacao', 'descricao', 'ano', 'cliente'].includes(key)) return;
    if (key === sortBy) setSortOrder((value) => value === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key as EquipamentoSortBy); setSortOrder('asc'); }
    setPage(1);
  }
  const columns: TableColumn<EquipamentoDTO>[] = [
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
      header: '',
      align: 'right',
      render: (v) =>
        hasPermission('OS_EDIT') ? (
          <Button
            variant="secondary"
            size="sm"
            className={styles.editButton}
            onClick={() => setModal({ veiculo: v })}
            aria-label={`Editar veículo ${v.identificacao || v.codigo}`}
            title={`Editar veículo ${v.identificacao || v.codigo}`}
          >
            <ActionIcon name="edit" />
          </Button>
        ) : null,
    },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        title="Veículos"
        description="Consulte os veículos ativos e seus clientes vinculados."
        actions={
          hasPermission('OS_CREATE') ? (
            <span className={styles.desktopCreate}>
              <Button onClick={() => setModal({})}>
                <ActionIcon name="add" />
                Novo veículo
              </Button>
            </span>
          ) : undefined
        }
      />
      {data && !isLoading && !isError && <p className={styles.total}><strong>{data.total.toLocaleString('pt-BR')}</strong> {data.total === 1 ? 'registro' : 'registros'}</p>}
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
        <ResponsiveFilters activeCount={Number(Boolean(cliente)) + Number(Boolean(anoFabricacao))} onClear={() => { setCliente(null); setAnoFabricacao(''); setPage(1); }}>
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
            <EmptyState title="Nenhum veículo encontrado" />
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
                      hasPermission('OS_EDIT') ? (
                        <Button variant="secondary" size="sm" className={styles.editButton} onClick={() => setModal({ veiculo })} aria-label={`Editar veículo ${veiculo.identificacao || veiculo.codigo}`} title={`Editar veículo ${veiculo.identificacao || veiculo.codigo}`}>
                          <ActionIcon name="edit" />
                        </Button>
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
      {hasPermission('OS_CREATE') && (
        <MobileFab label="Novo veículo" onClick={() => setModal({})} />
      )}
    </div>
  );
}
