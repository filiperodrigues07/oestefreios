import { useState } from 'react';
import { listarProdutosCatalogo } from '../api/produtos.api.js';
import { listarServicosCatalogo } from '../api/servicos.api.js';
import { CatalogTable } from '../components/catalog/CatalogTable.js';
import { Modal, PageHeader, Tabs, type TableColumn } from '../components/ui/index.js';
import { hasPermission } from '../store/authStore.js';
import type { ProdutoDTO, ServicoDTO } from '../types/cherp.types.js';
import styles from './ProdutosPage.module.css';

type Tab = 'produtos' | 'servicos';

function formatMoney(value?: number): string | undefined {
  return value !== undefined ? `R$ ${value.toFixed(2)}` : undefined;
}

/** Catálogo do CHERP: toda filtragem, ordenação e visibilidade financeira continuam delegadas às fontes existentes. */
export function ProdutosPage() {
  const [tab, setTab] = useState<Tab>('produtos');
  const [produtoSelecionado, setProdutoSelecionado] = useState<ProdutoDTO | null>(null);
  const [servicoSelecionado, setServicoSelecionado] = useState<ServicoDTO | null>(null);
  const podeVerFinanceiro = hasPermission('FINANCIAL_VIEW');

  const colunasProdutos: TableColumn<ProdutoDTO>[] = [
    { key: 'codigo', header: 'Código interno', render: (p) => p.codigo, mono: true, sortable: true },
    { key: 'descricao', header: 'Descrição', render: (p) => p.descricao, sortable: true },
    { key: 'unidade', header: 'Unidade', render: (p) => p.unidade },
    { key: 'categoria', header: 'Categoria', render: (p) => p.categoria ?? '—' },
    ...(podeVerFinanceiro
      ? [{ key: 'preco', header: 'Preço', render: (p: ProdutoDTO) => formatMoney(p.precoUnitario) ?? '—', align: 'right' as const, mono: true }]
      : []),
    {
      key: 'saldo',
      header: 'Saldo em estoque',
      align: 'right',
      mono: true,
      render: (p) => {
        const abaixoDoMinimo =
          p.disponivel !== undefined && p.estoqueMinimo !== undefined && p.disponivel < p.estoqueMinimo;
        return <span className={abaixoDoMinimo ? styles.stockLow : undefined}>{p.disponivel ?? '—'}</span>;
      },
    },
  ];

  const colunasServicos: TableColumn<ServicoDTO>[] = [
    { key: 'codigo', header: 'Código', render: (s) => s.codigo, mono: true, sortable: true },
    { key: 'descricao', header: 'Descrição', render: (s) => s.descricao, sortable: true },
    { key: 'categoria', header: 'Categoria', render: (s) => s.categoria ?? '—' },
    ...(podeVerFinanceiro
      ? [{ key: 'valor', header: 'Preço', render: (s: ServicoDTO) => formatMoney(s.valorUnitario) ?? '—', align: 'right' as const, mono: true }]
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
            fetchFn={listarProdutosCatalogo}
            columns={colunasProdutos}
            onSelect={setProdutoSelecionado}
            emptyLabel="Nenhum produto encontrado."
          />
        ) : (
          <CatalogTable<ServicoDTO>
            key="servicos"
            queryKey="servicos-catalogo"
            fetchFn={listarServicosCatalogo}
            columns={colunasServicos}
            onSelect={setServicoSelecionado}
            emptyLabel="Nenhum serviço encontrado."
          />
        )}
      </Tabs>

      <Modal open={produtoSelecionado !== null} title="Detalhe do produto" onClose={() => setProdutoSelecionado(null)}>
        {produtoSelecionado && (
          <dl className={styles.details}>
            <DetailRow label="Código" value={produtoSelecionado.codigo} />
            <DetailRow label="Descrição" value={produtoSelecionado.descricao} />
            <DetailRow label="Unidade" value={produtoSelecionado.unidade} />
            {produtoSelecionado.categoria && <DetailRow label="Categoria" value={produtoSelecionado.categoria} />}
            {produtoSelecionado.disponivel !== undefined && <DetailRow label="Disponível" value={String(produtoSelecionado.disponivel)} />}
            {podeVerFinanceiro && produtoSelecionado.precoUnitario !== undefined && (
              <DetailRow label="Preço unitário" value={formatMoney(produtoSelecionado.precoUnitario)!} />
            )}
            {podeVerFinanceiro && produtoSelecionado.custo !== undefined && (
              <DetailRow label="Custo" value={formatMoney(produtoSelecionado.custo)!} />
            )}
          </dl>
        )}
      </Modal>

      <Modal open={servicoSelecionado !== null} title="Detalhe do serviço" onClose={() => setServicoSelecionado(null)}>
        {servicoSelecionado && (
          <dl className={styles.details}>
            <DetailRow label="Código" value={servicoSelecionado.codigo} />
            <DetailRow label="Descrição" value={servicoSelecionado.descricao} />
            {servicoSelecionado.categoria && <DetailRow label="Categoria" value={servicoSelecionado.categoria} />}
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
