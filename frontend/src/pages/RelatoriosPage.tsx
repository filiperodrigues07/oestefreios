import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { usePageRefresh } from '../hooks/usePageRefresh.js';
import {
  baixarRelatorioClientes,
  baixarRelatorioOS,
  baixarRelatorioProdutosServicos,
  getRelatorioClientes,
  getRelatorioOS,
  getRelatorioProdutosServicos,
  type RelatorioClientesFiltro,
  type RelatorioOSFiltro,
  type RelatorioProdutosServicosFiltro,
  type RelatorioResultado,
  type RelatorioValor,
} from '../api/relatorios.api.js';
import { OS_STATUS_CONFIG } from '../constants/osStatus.js';
import {
  ActionIcon,
  Badge,
  Button,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Table,
  Tabs,
  useToast,
  type TableColumn,
} from '../components/ui/index.js';
import { hasPermission } from '../store/authStore.js';
import type { OSStatus } from '../types/os.types.js';
import styles from './RelatoriosPage.module.css';

type Tab = 'os' | 'clientes' | 'produtos-servicos';
type LinhaRelatorio = Record<string, RelatorioValor> & { __idx?: number };

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  ...(Object.keys(OS_STATUS_CONFIG) as OSStatus[]).map((status) => ({ value: status, label: OS_STATUS_CONFIG[status].label })),
];

const TIPO_PESSOA_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'PJ', label: 'Pessoa Jurídica' },
  { value: 'PF', label: 'Pessoa Física' },
];

const PRIORIDADE_OPTIONS = [
  { value: '', label: 'Todas as prioridades' },
  { value: 'BAIXA', label: 'Baixa' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'MEDIA', label: 'Média' },
  { value: 'ALTA', label: 'Alta' },
];

const DATA_REFERENCIA_OPTIONS = [
  { value: 'abertura', label: 'Data de abertura' },
  { value: 'conclusao', label: 'Data de conclusão' },
];

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatarDataInput(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

function periodoAtalho(tipo: 'hoje' | 'sete-dias' | 'mes-atual'): { inicio: string; fim: string } {
  const fim = new Date();
  fim.setHours(0, 0, 0, 0);
  const inicio = new Date(fim);
  if (tipo === 'sete-dias') inicio.setDate(inicio.getDate() - 6);
  if (tipo === 'mes-atual') inicio.setDate(1);
  return { inicio: formatarDataInput(inicio), fim: formatarDataInput(fim) };
}

function primeiroDiaDoMes(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function formatarValor(valor: RelatorioValor, tipo?: string): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (tipo === 'moeda' && typeof valor === 'number') {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  }
  if (tipo === 'data') return new Date(valor as string).toLocaleDateString('pt-BR');
  return String(valor);
}

function buildColumns(relatorio: RelatorioResultado): TableColumn<LinhaRelatorio>[] {
  return relatorio.colunas.map((col) => ({
    key: col.key,
    header: col.label,
    align: col.alinhamento,
    mono: col.tipo === 'moeda' || col.tipo === 'numero' || col.tipo === 'data',
    render: (row) => formatarValor(row[col.key] ?? null, col.tipo),
  }));
}

/** Prévia + exportação de relatórios (Excel/PDF com o logo/cor de Configurações > Geral). */
const TABS_VALIDAS: Tab[] = ['os', 'clientes', 'produtos-servicos'];

export function RelatoriosPage() {
  const [searchParams] = useSearchParams();
  const tabInicial = searchParams.get('tab');
  const [tab, setTab] = useState<Tab>(
    tabInicial && TABS_VALIDAS.includes(tabInicial as Tab) ? (tabInicial as Tab) : 'os',
  );

  return (
    <div className={styles.page}>
      <PageHeader className={styles.hero} title="Relatórios" description="Gere relatórios por período e exporte em Excel ou PDF." />

      <section className={styles.workspace}>
      <Tabs
        items={[
          { key: 'os', label: 'Ordens de Serviço' },
          { key: 'clientes', label: 'Clientes' },
          { key: 'produtos-servicos', label: 'Produtos e Serviços' },
        ]}
        active={tab}
        onChange={(key) => setTab(key as Tab)}
        variant="segmented"
        fullWidth
      >
        {tab === 'os' && <RelatorioOSTab />}
        {tab === 'clientes' && <RelatorioClientesTab />}
        {tab === 'produtos-servicos' && <RelatorioProdutosServicosTab />}
      </Tabs>
      </section>
    </div>
  );
}

function RelatorioOSTab() {
  const { showToast } = useToast();
  const [dataInicial, setDataInicial] = useState(primeiroDiaDoMes());
  const [dataFinal, setDataFinal] = useState(hoje());
  const [dataReferencia, setDataReferencia] = useState<'abertura' | 'conclusao'>('abertura');
  const [status, setStatus] = useState('');
  const [prioridade, setPrioridade] = useState('');
  const [busca, setBusca] = useState('');
  const [relatorio, setRelatorio] = useState<RelatorioResultado | null>(null);
  const mostrarFinanceiro = hasPermission('FINANCIAL_VIEW');

  const filtro = (): RelatorioOSFiltro => ({
    dataInicial,
    dataFinal,
    dataReferencia,
    status: status || undefined,
    prioridade: prioridade || undefined,
    busca: busca || undefined,
  });

  const gerarMutation = useMutation({
    mutationFn: () => getRelatorioOS(filtro()),
    onSuccess: setRelatorio,
    onError: (err) => showToast(err instanceof Error ? err.message : 'Não foi possível gerar o relatório.', 'danger'),
  });

  const exportMutation = useMutation({
    mutationFn: (formato: 'excel' | 'pdf') => baixarRelatorioOS(filtro(), formato),
    onError: (err) => showToast(err instanceof Error ? err.message : 'Não foi possível exportar.', 'danger'),
  });
  usePageRefresh(() => gerarMutation.mutateAsync());

  return (
    <div className={styles.tab}>
      <div className={styles.quickPeriodBar}>
        <span>Períodos rápidos</span>
        <AtalhosPeriodo dataInicial={dataInicial} dataFinal={dataFinal} onSelect={({ inicio, fim }) => { setDataInicial(inicio); setDataFinal(fim); }} />
      </div>
      <form className={styles.filtros} onSubmit={(e) => { e.preventDefault(); gerarMutation.mutate(); }}>
        <Input label="Data inicial" type="date" value={dataInicial} onChange={(e) => setDataInicial(e.target.value)} />
        <Input label="Data final" type="date" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} />
        <Select label="Considerar por" options={DATA_REFERENCIA_OPTIONS} value={dataReferencia} onChange={(e) => setDataReferencia(e.target.value as 'abertura' | 'conclusao')} />
        <Select label="Status" options={STATUS_OPTIONS} value={status} onChange={(e) => setStatus(e.target.value)} />
        <Select label="Prioridade" options={PRIORIDADE_OPTIONS} value={prioridade} onChange={(e) => setPrioridade(e.target.value)} />
        <Input label="Buscar" placeholder="OS, cliente ou veículo" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <Button type="submit" loading={gerarMutation.isPending}>
          <ActionIcon name="search" />
          Gerar
        </Button>
      </form>

      {!mostrarFinanceiro && <Badge tone="neutral">Valores financeiros ocultos — sem permissão para vê-los.</Badge>}

      <RelatorioPreview
        relatorio={relatorio}
        loading={gerarMutation.isPending}
        onExportar={(formato) => exportMutation.mutate(formato)}
        exportando={exportMutation.isPending}
      />
    </div>
  );
}

function RelatorioClientesTab() {
  const { showToast } = useToast();
  const [tipoPessoa, setTipoPessoa] = useState<'' | 'PF' | 'PJ'>('');
  const [uf, setUf] = useState('');
  const [busca, setBusca] = useState('');
  const [relatorio, setRelatorio] = useState<RelatorioResultado | null>(null);

  const filtro = (): RelatorioClientesFiltro => ({ tipoPessoa: tipoPessoa || undefined, uf: uf || undefined, busca: busca || undefined });

  const gerarMutation = useMutation({
    mutationFn: () => getRelatorioClientes(filtro()),
    onSuccess: setRelatorio,
    onError: (err) => showToast(err instanceof Error ? err.message : 'Não foi possível gerar o relatório.', 'danger'),
  });

  const exportMutation = useMutation({
    mutationFn: (formato: 'excel' | 'pdf') => baixarRelatorioClientes(filtro(), formato),
    onError: (err) => showToast(err instanceof Error ? err.message : 'Não foi possível exportar.', 'danger'),
  });
  usePageRefresh(() => gerarMutation.mutateAsync());

  return (
    <div className={styles.tab}>
      <form className={styles.filtros} onSubmit={(e) => { e.preventDefault(); gerarMutation.mutate(); }}>
        <Input label="Buscar" placeholder="Nome, código, CNPJ/CPF..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        <Select label="Tipo" options={TIPO_PESSOA_OPTIONS} value={tipoPessoa} onChange={(e) => setTipoPessoa(e.target.value as '' | 'PF' | 'PJ')} />
        <Input label="UF" placeholder="Ex.: SC" maxLength={2} value={uf} onChange={(e) => setUf(e.target.value.toUpperCase())} />
        <Button type="submit" loading={gerarMutation.isPending}>
          <ActionIcon name="search" />
          Gerar
        </Button>
      </form>

      <RelatorioPreview
        relatorio={relatorio}
        loading={gerarMutation.isPending}
        onExportar={(formato) => exportMutation.mutate(formato)}
        exportando={exportMutation.isPending}
      />
    </div>
  );
}

function RelatorioProdutosServicosTab() {
  const { showToast } = useToast();
  const [dataInicial, setDataInicial] = useState(primeiroDiaDoMes());
  const [dataFinal, setDataFinal] = useState(hoje());
  const [dataReferencia, setDataReferencia] = useState<'abertura' | 'conclusao'>('abertura');
  const [relatorio, setRelatorio] = useState<RelatorioResultado | null>(null);
  const mostrarFinanceiro = hasPermission('FINANCIAL_VIEW');

  const filtro = (): RelatorioProdutosServicosFiltro => ({ dataInicial, dataFinal, dataReferencia });

  const gerarMutation = useMutation({
    mutationFn: () => getRelatorioProdutosServicos(filtro()),
    onSuccess: setRelatorio,
    onError: (err) => showToast(err instanceof Error ? err.message : 'Não foi possível gerar o relatório.', 'danger'),
  });

  const exportMutation = useMutation({
    mutationFn: (formato: 'excel' | 'pdf') => baixarRelatorioProdutosServicos(filtro(), formato),
    onError: (err) => showToast(err instanceof Error ? err.message : 'Não foi possível exportar.', 'danger'),
  });
  usePageRefresh(() => gerarMutation.mutateAsync());

  return (
    <div className={styles.tab}>
      <div className={styles.quickPeriodBar}>
        <span>Períodos rápidos</span>
        <AtalhosPeriodo dataInicial={dataInicial} dataFinal={dataFinal} onSelect={({ inicio, fim }) => { setDataInicial(inicio); setDataFinal(fim); }} />
      </div>
      <form className={styles.filtros} onSubmit={(e) => { e.preventDefault(); gerarMutation.mutate(); }}>
        <Input label="Data inicial" type="date" value={dataInicial} onChange={(e) => setDataInicial(e.target.value)} />
        <Input label="Data final" type="date" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} />
        <Select label="Considerar por" options={DATA_REFERENCIA_OPTIONS} value={dataReferencia} onChange={(e) => setDataReferencia(e.target.value as 'abertura' | 'conclusao')} />
        <Button type="submit" loading={gerarMutation.isPending}>
          <ActionIcon name="search" />
          Gerar
        </Button>
      </form>

      {!mostrarFinanceiro && <Badge tone="neutral">Valores financeiros ocultos — sem permissão para vê-los.</Badge>}

      <RelatorioPreview
        relatorio={relatorio}
        loading={gerarMutation.isPending}
        onExportar={(formato) => exportMutation.mutate(formato)}
        exportando={exportMutation.isPending}
      />
    </div>
  );
}

interface RelatorioPreviewProps {
  relatorio: RelatorioResultado | null;
  loading: boolean;
  exportando: boolean;
  onExportar: (formato: 'excel' | 'pdf') => void;
}

function AtalhosPeriodo({
  dataInicial,
  dataFinal,
  onSelect,
}: {
  dataInicial: string;
  dataFinal: string;
  onSelect: (periodo: { inicio: string; fim: string }) => void;
}) {
  const opcoes: { tipo: 'hoje' | 'sete-dias' | 'mes-atual'; label: string }[] = [
    { tipo: 'hoje', label: 'Hoje' },
    { tipo: 'sete-dias', label: '7 dias' },
    { tipo: 'mes-atual', label: 'Este mês' },
  ];
  return (
    <div className={styles.atalhos} aria-label="Atalhos de período">
      {opcoes.map(({ tipo, label }) => {
        const periodo = periodoAtalho(tipo);
        const ativo = periodo.inicio === dataInicial && periodo.fim === dataFinal;
        return (
          <button
            key={tipo}
            type="button"
            aria-pressed={ativo}
            className={ativo ? styles.atalhoAtivo : undefined}
            onClick={() => onSelect(periodo)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function RelatorioPreview({ relatorio, loading, exportando, onExportar }: RelatorioPreviewProps) {
  if (loading) {
    return (
      <div className={styles.loading}>
        <Skeleton height={44} />
        <Skeleton height={44} />
        <Skeleton height={44} />
      </div>
    );
  }

  if (!relatorio) {
    return <EmptyState className={styles.emptyReport} title="Pronto para gerar seu relatório" description="Escolha um período, refine os filtros se necessário e clique em Gerar. A prévia aparecerá aqui antes da exportação." />;
  }

  if (relatorio.linhas.length === 0) {
    return <EmptyState title="Nenhum registro encontrado para esse filtro" />;
  }

  const colunaMoeda = relatorio.colunas.find((coluna) => coluna.tipo === 'moeda');
  const colunaQuantidade = relatorio.colunas.find((coluna) => coluna.key === 'quantidade');
  const totalMoeda = colunaMoeda
    ? relatorio.linhas.reduce((total, linha) => total + (typeof linha[colunaMoeda.key] === 'number' ? linha[colunaMoeda.key] as number : 0), 0)
    : null;
  const totalQuantidade = colunaQuantidade
    ? relatorio.linhas.reduce((total, linha) => total + (typeof linha[colunaQuantidade.key] === 'number' ? linha[colunaQuantidade.key] as number : 0), 0)
    : null;

  return (
    <>
      <div className={styles.resumo}>
        <div className={styles.resumoCard}><span>Registros</span><strong>{relatorio.linhas.length.toLocaleString('pt-BR')}</strong></div>
        {totalQuantidade !== null && <div className={styles.resumoCard}><span>Quantidade total</span><strong>{totalQuantidade.toLocaleString('pt-BR')}</strong></div>}
        {totalMoeda !== null && <div className={styles.resumoCard}><span>{colunaMoeda?.label ?? 'Total'}</span><strong>{formatarValor(totalMoeda, 'moeda')}</strong></div>}
      </div>
      <div className={styles.previewHeader}>
        <div>
          <p className={styles.total}>
            <strong>{relatorio.linhas.length.toLocaleString('pt-BR')}</strong> {relatorio.linhas.length === 1 ? 'registro' : 'registros'}
          </p>
          <p className={styles.contexto}>
            {relatorio.periodo && `Período: ${new Date(relatorio.periodo.inicio).toLocaleDateString('pt-BR')} a ${new Date(relatorio.periodo.fim).toLocaleDateString('pt-BR')} · `}
            Gerado em {new Date(relatorio.geradoEm).toLocaleString('pt-BR')}
          </p>
        </div>
        <div className={styles.exportActions}>
          <Button variant="secondary" size="sm" loading={exportando} onClick={() => onExportar('excel')}>
            <ActionIcon name="excel" />
            Exportar Excel
          </Button>
          <Button variant="secondary" size="sm" loading={exportando} onClick={() => onExportar('pdf')}>
            <ActionIcon name="pdf" />
            Exportar PDF
          </Button>
        </div>
      </div>
      <Table
        columns={buildColumns(relatorio)}
        data={relatorio.linhas.map((linha, i) => ({ ...linha, __idx: i }))}
        rowKey={(row) => String(row.__idx)}
      />
    </>
  );
}
