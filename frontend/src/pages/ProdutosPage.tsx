import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { listarProdutosCatalogo, listarTiposProduto } from '../api/produtos.api.js';
import {
  baixarRelatorioCatalogoProdutos,
  baixarRelatorioCatalogoServicos,
} from '../api/relatorios.api.js';
import { listarServicosCatalogo, listarTiposServico } from '../api/servicos.api.js';
import { CatalogTable } from '../components/catalog/CatalogTable.js';
import { CurrencyCell } from '../components/ui/CurrencyCell.js';
import {
  MobileRecordCard,
  Modal,
  PageHeader,
  ExportButtons,
  ResponsiveFilters,
  Select,
  Tabs,
  type TableColumn,
} from '../components/ui/index.js';
import { hasPermission } from '../store/authStore.js';
import type { ProdutoDTO, ServicoDTO } from '../types/cherp.types.js';
import { readStoredFilters, writeStoredFilters } from '../utils/filterStorage.js';
import styles from './ProdutosPage.module.css';

type Tab = 'produtos' | 'servicos';

function formatMoney(value?: number): string | undefined {
  return value !== undefined ? `R$ ${value.toFixed(2)}` : undefined;
}

function formatSaldo(value?: number): string {
  return value === undefined ? '—' : value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Catálogo do CHERP: toda filtragem, ordenação e visibilidade financeira continuam delegadas às fontes existentes. */
export function ProdutosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filtrosSalvos = readStoredFilters('produtos');
  const initialTab: Tab = (searchParams.get('tipo') ?? filtrosSalvos.get('tipo')) === 'servicos' ? 'servicos' : 'produtos';
  const initialSearch = searchParams.get('busca') ?? filtrosSalvos.get('busca') ?? '';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [produtoSelecionado, setProdutoSelecionado] = useState<ProdutoDTO | null>(null);
  const [servicoSelecionado, setServicoSelecionado] = useState<ServicoDTO | null>(null);
  const [buscaProdutos, setBuscaProdutos] = useState(initialTab === 'produtos' ? initialSearch : '');
  const [buscaServicos, setBuscaServicos] = useState(initialTab === 'servicos' ? initialSearch : '');
  const [tipoCodigo, setTipoCodigo] = useState(() => searchParams.get('tipoCodigo') ?? filtrosSalvos.get('tipoCodigo') ?? '');
  const [tipoServicoCodigo, setTipoServicoCodigo] = useState(() => searchParams.get('tipoServicoCodigo') ?? filtrosSalvos.get('tipoServicoCodigo') ?? '');
  const [tipoModo, setTipoModo] = useState<'somente' | 'exceto'>(() =>
    (searchParams.get('tipoModo') ?? filtrosSalvos.get('tipoModo')) === 'exceto' ? 'exceto' : 'somente',
  );
  const [saldoModo, setSaldoModo] = useState<'todos' | 'com_saldo' | 'sem_saldo' | 'negativo'>(() => {
    const value = searchParams.get('saldoModo') ?? filtrosSalvos.get('saldoModo');
    return value === 'com_saldo' || value === 'sem_saldo' || value === 'negativo' ? value : 'todos';
  });
  const { data: tipos = [] } = useQuery({ queryKey: ['tipos-produto'], queryFn: listarTiposProduto });
  const { data: tiposServico = [] } = useQuery({ queryKey: ['tipos-servico'], queryFn: listarTiposServico, enabled: tab === 'servicos' });

  // Filtros salvos na URL (compartilhável, funciona com voltar do navegador) e em sessionStorage
  // (sobrevive a navegar pra outra tela pelo menu, que troca de rota sem manter query string).
  // `replace` pra não empilhar histórico a cada tecla/seleção.
  useEffect(() => {
    const params = new URLSearchParams();
    if (tab === 'servicos') params.set('tipo', 'servicos');
    const buscaAtual = tab === 'produtos' ? buscaProdutos : buscaServicos;
    if (buscaAtual) params.set('busca', buscaAtual);
    if (tab === 'produtos') {
      if (tipoCodigo) {
        params.set('tipoCodigo', tipoCodigo);
        params.set('tipoModo', tipoModo);
      }
      if (saldoModo !== 'todos') params.set('saldoModo', saldoModo);
    } else if (tipoServicoCodigo) {
      params.set('tipoServicoCodigo', tipoServicoCodigo);
    }
    setSearchParams(params, { replace: true });
    writeStoredFilters('produtos', params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, buscaProdutos, buscaServicos, tipoCodigo, tipoModo, saldoModo, tipoServicoCodigo]);
  const filtroTipo = tipoCodigo ? { tipoCodigo: Number(tipoCodigo), tipoModo } : {};
  const filtroSaldo = saldoModo !== 'todos' ? { saldoModo } : {};
  const filtroRelatorioProdutos = { busca: buscaProdutos || undefined, ...filtroTipo, ...filtroSaldo };
  const filtroRelatorioServicos = { busca: buscaServicos || undefined, tipoServicoCodigo: tipoServicoCodigo || undefined };
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
            {formatSaldo(p.disponivel)}
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
    {
      key: 'tipo',
      header: 'Tipo de serviço',
      render: (s) => s.tipoServicoCodigo ?? '—',
      mono: true,
      sortable: true,
      width: '155px',
    },
    { key: 'descricao', header: 'Descrição', render: (s) => s.descricao, sortable: true },
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
        actions={<ExportButtons
          onExportarExcel={() => tab === 'produtos'
            ? baixarRelatorioCatalogoProdutos(filtroRelatorioProdutos, 'excel')
            : baixarRelatorioCatalogoServicos(filtroRelatorioServicos, 'excel')}
          onExportarPdf={() => tab === 'produtos'
            ? baixarRelatorioCatalogoProdutos(filtroRelatorioProdutos, 'pdf')
            : baixarRelatorioCatalogoServicos(filtroRelatorioServicos, 'pdf')}
        />}
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
            initialSearch={buscaProdutos}
            fetchFn={listarProdutosCatalogo}
            columns={colunasProdutos}
            onSelect={setProdutoSelecionado}
            emptyLabel="Nenhum produto encontrado."
            searchPlaceholder="Buscar por código, descrição, tipo ou grupo"
            columnPrefsKey="produtos"
            onFilterChange={setBuscaProdutos}
            extraParams={{ ...filtroTipo, ...filtroSaldo }}
            onClearExtraFilters={() => { setTipoCodigo(''); setTipoModo('somente'); setSaldoModo('todos'); }}
            filters={<ResponsiveFilters
              activeCount={Number(Boolean(tipoCodigo)) + Number(saldoModo !== 'todos')}
              onClear={() => { setTipoCodigo(''); setTipoModo('somente'); setSaldoModo('todos'); }}
            >
              <Select
                label="Tipo de produto"
                value={tipoCodigo}
                onChange={(event) => setTipoCodigo(event.target.value)}
                options={[{ value: '', label: 'Todos os tipos' }, ...tipos.map((tipo) => ({ value: String(tipo.codigo), label: tipo.descricao }))]}
              />
              <Select
                label="Filtro"
                value={tipoModo}
                onChange={(event) => setTipoModo(event.target.value as 'somente' | 'exceto')}
                options={[{ value: 'somente', label: 'Somente este tipo' }, { value: 'exceto', label: 'Tudo exceto este tipo' }]}
              />
              <Select
                label="Disponibilidade"
                value={saldoModo}
                onChange={(event) => setSaldoModo(event.target.value as typeof saldoModo)}
                options={[
                  { value: 'todos', label: 'Todos' },
                  { value: 'com_saldo', label: 'Com saldo' },
                  { value: 'sem_saldo', label: 'Sem saldo' },
                  { value: 'negativo', label: 'Saldo negativo' },
                ]}
              />
            </ResponsiveFilters>}
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
                        {formatSaldo(produto.disponivel)}
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
            initialSearch={buscaServicos}
            fetchFn={listarServicosCatalogo}
            columns={colunasServicos}
            onSelect={setServicoSelecionado}
            emptyLabel="Nenhum serviço encontrado."
            searchPlaceholder="Buscar por código, descrição ou tipo"
            columnPrefsKey="servicos"
            onFilterChange={setBuscaServicos}
            extraParams={{ tipoServicoCodigo: tipoServicoCodigo || undefined }}
            onClearExtraFilters={() => setTipoServicoCodigo('')}
            filters={<ResponsiveFilters
              activeCount={Number(Boolean(tipoServicoCodigo))}
              onClear={() => setTipoServicoCodigo('')}
            >
              <div className={styles.serviceTypeFilter}>
                <Select
                  label="Tipo de serviço"
                  value={tipoServicoCodigo}
                  title={tiposServico.find((tipo) => tipo.codigo === tipoServicoCodigo)?.descricao}
                  onChange={(event) => setTipoServicoCodigo(event.target.value)}
                  options={[{ value: '', label: 'Todos os tipos' }, ...tiposServico.map((tipo) => ({
                    value: tipo.codigo,
                    label: `${tipo.codigo} — ${tipo.descricao.length > 42 ? `${tipo.descricao.slice(0, 42).trimEnd()}…` : tipo.descricao}`,
                  }))]}
                />
              </div>
            </ResponsiveFilters>}
            renderMobileCard={(servico) => (
              <MobileRecordCard
                eyebrow={servico.codigo}
                title={servico.descricao}
                subtitle={servico.tipoServicoCodigo ? `Tipo de serviço ${servico.tipoServicoCodigo}` : 'Tipo de serviço não informado'}
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
              <DetailRow label="Disponível" value={formatSaldo(produtoSelecionado.disponivel)} />
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
            {servicoSelecionado.tipoServicoCodigo && (
              <DetailRow label="Tipo de serviço" value={`${servicoSelecionado.tipoServicoCodigo}${servicoSelecionado.tipoServicoDescricao ? ` — ${servicoSelecionado.tipoServicoDescricao}` : ''}`} />
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
