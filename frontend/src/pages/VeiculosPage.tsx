import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { listarEquipamentos } from '../api/equipamentos.api.js';
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
  SearchInput,
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
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [modal, setModal] = useState<{ veiculo?: EquipamentoDTO } | null>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['equipamentos', 'lista', buscaAtiva, cliente?.codigo, page, limit],
    queryFn: () => listarEquipamentos(buscaAtiva, page, limit, cliente?.codigo),
  });
  const columns: TableColumn<EquipamentoDTO>[] = [
    { key: 'identificacao', header: 'Placa', mono: true, render: (v) => v.identificacao || '—' },
    { key: 'descricao', header: 'Marca / Modelo', render: (v) => v.descricao },
    {
      key: 'ano',
      header: 'Ano fab. / mod.',
      render: (v) => `${v.anoFabricacao || '—'} / ${v.anoModelo || '—'}`,
    },
    {
      key: 'cliente',
      header: 'Cliente',
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
            onClick={() => setModal({ veiculo: v })}
            aria-label={`Editar veículo ${v.identificacao || v.codigo}`}
          >
            Editar
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
        <Button type="submit" variant="secondary">
          <ActionIcon name="search" />
          Buscar
        </Button>
      </form>
      <div className={styles.clientFilter}>
        {cliente ? (
          <>
            <span>
              Cliente: <strong>{cliente.nome}</strong>
            </span>
            <Button
              variant="secondary"
              onClick={() => {
                setCliente(null);
                setPage(1);
              }}
            >
              Todos os clientes
            </Button>
          </>
        ) : (
          <ClienteSearch
            label="Filtrar por cliente"
            onSelect={(value) => {
              setCliente(value);
              setPage(1);
            }}
          />
        )}
      </div>
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
          <p className={styles.total}>
            {data.total.toLocaleString('pt-BR')} {data.total === 1 ? 'veículo' : 'veículos'}
          </p>
          {data.items.length === 0 ? (
            <EmptyState title="Nenhum veículo encontrado" />
          ) : (
            <>
              <Table
                columns={columns}
                data={data.items}
                rowKey={(v) => v.codigo}
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
                        <Button variant="secondary" size="sm" onClick={() => setModal({ veiculo })}>
                          Editar
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
