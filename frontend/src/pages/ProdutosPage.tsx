import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { listarProdutosCatalogo } from '../api/produtos.api.js';
import {
  baixarRelatorioCatalogoProdutos,
  baixarRelatorioCatalogoServicos,
} from '../api/relatorios.api.js';
import { listarServicosCatalogo } from '../api/servicos.api.js';
import { CatalogTable } from '../components/catalog/CatalogTable.js';
import { CurrencyCell } from '../components/ui/CurrencyCell.js';
import {
  MobileRecordCard,
  Modal,
  PageHeader,
  Tabs,
  type TableColumn,
} from '../components/ui/index.js';
import { hasPermission } from '../store/authStore.js';
import type { ProdutoDTO, ServicoDTO } from '../types/cherp.types.js';
import styles from './ProdutosPage.module.css';

type Tab = 'produtos' | 'servicos';

function formatMoney(value?: number): string | undefined {
  return value !== undefined ? `R$ ${value.toFixed(2)}` : undefined;
}

/** Catálogo do CHERP: toda filtragem, ordenação e visibilidade financeira continuam delegadas às fontes existentes. */
export function ProdutosPage() {
  const [searchParams] = useSearchParams();
  const initialTab: Tab = searchParams.get('tipo') === 'servicos' ? 'servicos' : 'produtos';
  const initialSearch = searchParams.get('busca') ?? '';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [produtoSelecionado, setProdutoSelecionado] = useState<ProdutoDTO | null>(null);
  const [servicoSelecionado, setServicoSelecionado] = useState<ServicoDTO | null>(null);
  const podeVerFinanceiro = hasPermission('FINANCIAL_VIEW');

  const colunasProdutos: TableColumn<ProdutoDTO>[] = [
    {
      key: 'codigo',
      header: 'Código interno',
      render: (p) => p.codigo,
      mono: true,
      sortable: true,
      width: '128px',
    },
    { key: 'descricao', header: 'Descrição', render: (p) => p.descricao, sortable: true },
    { key: 'unidade', header: 'Unidade', render: (p) => p.unidade, width: '96px' },
    { key: 'tipo', header: 'Tipo', render: (p) => p.tipo ?? '—', sortable: true, width: '190px' },
    {
      key: 'categoria',
      header: 'Grupo Produto',
      render: (p) => p.categoria ?? '—',
      sortable: true,
      width: '180px',
    },
    ...(podeVerFinanceiro
      ? [
          {
            key: 'preco',
            header: 'Preço',
            render: (p: ProdutoDTO) => p.precoUnitario !== undefined
              ? <CurrencyCell amount={p.precoUnitario.toFixed(2)} /> : '—',
            align: 'right' as const,
            mono: true,
            width: '110px',
          },
        ]
      : []),
    {
      key: 'saldo',
      header: 'Saldo em estoque',
      align: 'right',
      mono: true,
      width: '140px',
      render: (p) => {
        const abaixoDoMinimo =
          p.disponivel !== undefined &&
          p.estoqueMinimo !== undefined &&
          p.disponivel < p.estoqueMinimo;
        return (
          <span className={abaixoDoMinimo ? styles.stockLow : undefined}>
            {p.disponivel ?? '—'}
          </span>
        );
      },
    },
  ];

  const colunasServicos: TableColumn<ServicoDTO>[] = [
    {
      key: 'codigo',
      header: 'Código',
      render: (s) => s.codigo,
      mono: true,
      sortable: true,
      width: '128px',
    },
    { key: 'descricao', header: 'Descrição', render: (s) => s.descricao, sortable: true },
    {
      key: 'categoria',
      header: 'Grupo Produto',
      render: (s) => s.categoria ?? '—',
      sortable: true,
      width: '180px',
    },
    ...(podeVerFinanceiro
      ? [
          {
            key: 'valor',
            header: 'Preço',
            render: (s: ServicoDTO) => s.valorUnitario !== undefined
              ? <CurrencyCell amount={s.valorUnitario.toFixed(2)} /> : '—',
            align: 'right' as const,
            mono: true,
            width: '110px',
          },
        ]
      : []),
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        title="Produtos e Serviços"
        description="Consulte o catálogo integrado e acesse os detalhes de produtos e serviços."
      />

      <Tabs
        items={[
          { key: 'produtos', label: 'Produtos' },
          { key: 'servicos', label: 'Serviços' },
        ]}
        active={tab}
        onChange={(key) => setTab(key as Tab)}
        variant="segmented"
        fullWidth
      >
        {tab === 'produtos' ? (
          <CatalogTable<ProdutoDTO>
            key="produtos"
            queryKey="produtos-catalogo"
            initialSearch={initialTab === 'produtos' ? initialSearch : ''}
            fetchFn={listarProdutosCatalogo}
            columns={colunasProdutos}
            onSelect={setProdutoSelecionado}
            emptyLabel="Nenhum produto encontrado."
            searchPlaceholder="Buscar por código, descrição, tipo ou grupo"
            columnPrefsKey="produtos"
            onExportarExcel={(busca) =>
              baixarRelatorioCatalogoProdutos({ busca: busca || undefined }, 'excel')
            }
            onExportarPdf={(busca) =>
              baixarRelatorioCatalogoProdutos({ busca: busca || undefined }, 'pdf')
            }
            renderMobileCard={(produto) => (
              <MobileRecordCard
                eyebrow={produto.codigo}
                title={produto.descricao}
                subtitle={
                  [produto.tipo, produto.categoria].filter(Boolean).join(' · ') ||
                  'Sem grupo informado'
                }
                fields={[
                  { label: 'Unidade', value: produto.unidade },
                  {
                    label: 'Saldo',
                    value: (
                      <span
                        className={
                          produto.disponivel !== undefined &&
                          produto.estoqueMinimo !== undefined &&
                          produto.disponivel < produto.estoqueMinimo
                            ? styles.stockLow
                            : undefined
                        }
                      >
                        {produto.disponivel ?? '—'}
                      </span>
                    ),
                    mono: true,
                  },
                  ...(podeVerFinanceiro
                    ? [
                        {
                          label: 'Preço',
                          value: formatMoney(produto.precoUnitario) ?? '—',
                          mono: true,
                        },
                      ]
                    : []),
                ]}
              />
            )}
          />
        ) : (
          <CatalogTable<ServicoDTO>
            key="servicos"
            queryKey="servicos-catalogo"
            initialSearch={initialTab === 'servicos' ? initialSearch : ''}
            fetchFn={listarServicosCatalogo}
            columns={colunasServicos}
            onSelect={setServicoSelecionado}
            emptyLabel="Nenhum serviço encontrado."
            searchPlaceholder="Buscar por código, descrição, tipo ou grupo"
            columnPrefsKey="servicos"
            onExportarExcel={(busca) =>
              baixarRelatorioCatalogoServicos({ busca: busca || undefined }, 'excel')
            }
            onExportarPdf={(busca) =>
              baixarRelatorioCatalogoServicos({ busca: busca || undefined }, 'pdf')
            }
            renderMobileCard={(servico) => (
              <MobileRecordCard
                eyebrow={servico.codigo}
                title={servico.descricao}
                subtitle={servico.categoria ?? 'Sem grupo informado'}
                fields={[
                  { label: 'Unidade', value: servico.unidade },
                  ...(podeVerFinanceiro
                    ? [
                        {
                          label: 'Preço',
                          value: formatMoney(servico.valorUnitario) ?? '—',
                          mono: true,
                        },
                      ]
                    : []),
                ]}
              />
            )}
          />
        )}
      </Tabs>

      <Modal
        open={produtoSelecionado !== null}
        title="Detalhe do produto"
        onClose={() => setProdutoSelecionado(null)}
      >
        {produtoSelecionado && (
          <dl className={styles.details}>
            <DetailRow label="Código" value={produtoSelecionado.codigo} />
            <DetailRow label="Descrição" value={produtoSelecionado.descricao} />
            <DetailRow label="Unidade" value={produtoSelecionado.unidade} />
            {produtoSelecionado.tipo && <DetailRow label="Tipo" value={produtoSelecionado.tipo} />}
            {produtoSelecionado.categoria && (
              <DetailRow label="Grupo Produto" value={produtoSelecionado.categoria} />
            )}
            {produtoSelecionado.disponivel !== undefined && (
              <DetailRow label="Disponível" value={String(produtoSelecionado.disponivel)} />
            )}
            {podeVerFinanceiro && produtoSelecionado.precoUnitario !== undefined && (
              <DetailRow
                label="Preço unitário"
                value={formatMoney(produtoSelecionado.precoUnitario)!}
              />
            )}
            {podeVerFinanceiro && produtoSelecionado.custo !== undefined && (
              <DetailRow label="Custo" value={formatMoney(produtoSelecionado.custo)!} />
            )}
          </dl>
        )}
      </Modal>

      <Modal
        open={servicoSelecionado !== null}
        title="Detalhe do serviço"
        onClose={() => setServicoSelecionado(null)}
      >
        {servicoSelecionado && (
          <dl className={styles.details}>
            <DetailRow label="Código" value={servicoSelecionado.codigo} />
            <DetailRow label="Descrição" value={servicoSelecionado.descricao} />
            {servicoSelecionado.categoria && (
              <DetailRow label="Grupo Produto" value={servicoSelecionado.categoria} />
            )}
            {podeVerFinanceiro && servicoSelecionado.valorUnitario !== undefined && (
              <DetailRow label="Valor" value={formatMoney(servicoSelecionado.valorUnitario)!} />
            )}
          </dl>
        )}
      </Modal>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className={styles.detailLabel}>{label}</dt>
      <dd className={styles.detailValue}>{value}</dd>
    </div>
  );
}
