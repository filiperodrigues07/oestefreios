import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { getDashboardOperacional } from '../../api/dashboard.api.js';
import { OS_DOCUMENT_STATUS_CONFIG, OS_PRIORITY_CONFIG } from '../../constants/osStatus.js';
import type { DashboardGranularidade, DashboardSerieDTO } from '../../types/dashboard.types.js';
import type { OSPrioridade } from '../../types/os.types.js';
import { EmptyState, ErrorState, PriorityBadge, Skeleton, StatusBadge } from '../ui/index.js';
import styles from './AdminDashboard.module.css';

type QuickPeriod = 'hoje' | '7dias' | '30dias' | 'mes' | 'personalizado';

const KPI_CONFIG: Array<{ key: 'total' | 'abertas' | 'geradoPedido' | 'geradoNF' | 'encerradas'; label: string; icon: string; className?: string }> = [
  { key: 'total', label: 'Total de OS', icon: '⌂', className: styles.kpiTotal },
  { key: 'abertas', label: 'Abertas', icon: '▤', className: styles.kpiOpen },
  { key: 'geradoPedido', label: 'Gerado Ped.', icon: '◷', className: styles.kpiWaiting },
  { key: 'geradoNF', label: 'Gerado NF', icon: '✓', className: styles.kpiDone },
  { key: 'encerradas', label: 'Encerradas', icon: '×' },
];

const PRIORITY_ORDER: OSPrioridade[] = ['ALTA', 'MEDIA', 'NORMAL', 'BAIXA'];

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function fromInput(value: string, end = false): Date {
  const date = new Date(`${value}T${end ? '23:59:59.999' : '00:00:00.000'}`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function periodDates(period: QuickPeriod, customStart: string, customEnd: string) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  if (period === 'hoje') start.setHours(0, 0, 0, 0);
  if (period === '7dias') start.setDate(start.getDate() - 6);
  if (period === '30dias') start.setDate(start.getDate() - 29);
  if (period === 'mes') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }
  if (period === 'personalizado') return { inicio: fromInput(customStart), fim: fromInput(customEnd, true) };
  return { inicio: start, fim: end };
}

function buildLinePath(values: number[], width: number, height: number, max: number) {
  if (values.length === 0) return '';
  const innerHeight = height - 28;
  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = innerHeight - (value / Math.max(max, 1)) * (innerHeight - 8) + 4;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

function EvolutionChart({ series }: { series: DashboardSerieDTO[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(1, ...series.flatMap((item) => [item.abertas, item.encerradas]));
  const width = 700;
  const height = 205;
  const opens = series.map((item) => item.abertas);
  const completed = series.map((item) => item.encerradas);
  const openPath = buildLinePath(opens, width, height, max);
  const completedPath = buildLinePath(completed, width, height, max);
  const active = hovered === null ? null : series[hovered];

  if (series.every((item) => item.abertas === 0 && item.encerradas === 0)) return <EmptyState title="Sem OS no período" description="Escolha outro intervalo para visualizar a evolução." />;

  return (
    <div className={styles.chartWrap}>
      <svg className={styles.lineChart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolução de OS abertas e concluídas">
        {[0.25, 0.5, 0.75, 1].map((step) => <line key={step} x1="0" x2={width} y1={(height - 28) * step} y2={(height - 28) * step} className={styles.gridLine} />)}
        <path d={`${openPath} L ${width} ${height - 24} L 0 ${height - 24} Z`} className={styles.openArea} />
        <path d={openPath} className={styles.openLine} />
        <path d={completedPath} className={styles.doneLine} />
        {series.map((item, index) => {
          const x = series.length === 1 ? width / 2 : (index / (series.length - 1)) * width;
          const yOpen = height - 28 - (item.abertas / max) * (height - 36) + 4;
          const yDone = height - 28 - (item.encerradas / max) * (height - 36) + 4;
          return <g key={item.chave} onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)}>
            <rect x={x - 10} y="0" width="20" height={height - 22} className={styles.hitArea} />
            <circle cx={x} cy={yOpen} r="3" className={styles.openDot} />
            <circle cx={x} cy={yDone} r="3" className={styles.doneDot} />
          </g>;
        })}
      </svg>
      <div className={styles.chartLabels}>{series.filter((_, index) => index % Math.max(1, Math.ceil(series.length / 7)) === 0 || index === series.length - 1).map((item) => <span key={item.chave}>{item.rotulo}</span>)}</div>
      {active && <div className={styles.chartTooltip}><strong>{active.rotulo}</strong><span>Abertas: {active.abertas}</span><span>Fechadas: {active.encerradas}</span></div>}
    </div>
  );
}

function Donut({ total, counts }: { total: number; counts: Record<number, number> }) {
  const groups = [
    { key: 0, color: '#3b82f6' },
    { key: 1, color: '#fbbf24' },
    { key: 2, color: '#f59e0b' },
    { key: 3, color: '#34d399' },
    { key: 4, color: '#94a3b8' },
    { key: 5, color: '#8b5cf6' },
    { key: 6, color: '#fb7185' },
  ].map((item) => ({
    ...item,
    label: OS_DOCUMENT_STATUS_CONFIG[item.key]?.label ?? 'Não informado',
    value: counts[item.key] ?? 0,
  }));
  let current = 0;
  const gradient = groups.map((item) => {
    const start = total ? (current / total) * 100 : 0;
    current += item.value;
    return `${item.color} ${start}% ${(current / Math.max(total, 1)) * 100}%`;
  }).join(', ');
  return <div className={styles.donutContent}>
    <div className={styles.donut} style={{ background: total ? `conic-gradient(${gradient})` : 'var(--color-neutral-surface)' }}><div><strong>{total}</strong><span>OS</span></div></div>
    <div className={styles.legend}>{groups.map((item) => <div key={item.key}><span><i style={{ background: item.color }} />{item.label}</span><strong>{item.value}</strong><small>{total ? Math.round((item.value / total) * 100) : 0}%</small></div>)}</div>
  </div>;
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const today = new Date();
  const [period, setPeriod] = useState<QuickPeriod>('30dias');
  const [customStart, setCustomStart] = useState(dateInputValue(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)));
  const [customEnd, setCustomEnd] = useState(dateInputValue(today));
  const [granularidade, setGranularidade] = useState<DashboardGranularidade>('diario');
  const dates = useMemo(() => periodDates(period, customStart, customEnd), [period, customStart, customEnd]);
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['dashboard-operacional', dates.inicio.toISOString(), dates.fim.toISOString(), granularidade], queryFn: () => getDashboardOperacional({ ...dates, granularidade }) });

  if (isLoading) return <div className={styles.loadingGrid}>{Array.from({ length: 7 }, (_, index) => <Skeleton key={index} height={index < 5 ? 130 : 300} />)}</div>;
  if (isError || !data) return <ErrorState error={error} action={<button className={styles.retry} onClick={() => refetch()}>Tentar novamente</button>} />;

  const values = {
    total: data.total,
    abertas: data.countsBySituacaoDocumento[0] ?? 0,
    geradoPedido: data.countsBySituacaoDocumento[1] ?? 0,
    geradoNF: data.countsBySituacaoDocumento[3] ?? 0,
    encerradas: data.countsBySituacaoDocumento[4] ?? 0,
  };
  const selectPeriod = (value: QuickPeriod) => setPeriod(value);
  const navigateStatus = (key: keyof typeof values) => {
    const params = new URLSearchParams();
    const situacaoPorKpi = { abertas: 0, geradoPedido: 1, geradoNF: 3, encerradas: 4 } as const;
    if (key !== 'total') params.set('situacaoDocumento', String(situacaoPorKpi[key]));
    navigate(`/os${params.size ? `?${params.toString()}` : ''}`);
  };

  return <div className={styles.dashboard}>
    <header className={styles.dashboardHeader}>
      <div><h1>Dashboard</h1><p>Visão geral das Ordens de Serviço</p></div>
      <div className={styles.periodControls}>
        <div className={styles.quickPeriods}>{[['hoje', 'Hoje'], ['7dias', '7 dias'], ['30dias', '30 dias'], ['mes', 'Este mês'], ['personalizado', 'Personalizado']].map(([value, label]) => <button key={value} onClick={() => selectPeriod(value as QuickPeriod)} className={period === value ? styles.periodActive : ''}>{label}</button>)}</div>
        {period === 'personalizado' ? <div className={styles.dateRange}><input type="date" aria-label="Data inicial" value={customStart} onChange={(e) => setCustomStart(e.target.value)} /><span>—</span><input type="date" aria-label="Data final" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} /></div> : <div className={styles.dateRange}>▣ {dates.inicio.toLocaleDateString('pt-BR')} - {dates.fim.toLocaleDateString('pt-BR')}</div>}
      </div>
    </header>
    <section className={styles.kpis}>{KPI_CONFIG.map((item) => <button key={item.key} className={`${styles.kpi} ${item.className}`} onClick={() => navigateStatus(item.key)}><span className={styles.kpiIcon}>{item.icon}</span><span className={styles.kpiLabel}>{item.label}</span><strong>{values[item.key].toLocaleString('pt-BR')}</strong><small>{item.key === 'total' ? 'no período selecionado' : `${data.total ? Math.round((values[item.key] / data.total) * 100) : 0}% do total`}</small><b>›</b></button>)}</section>
    <section className={styles.topGrid}>
      <article className={styles.panel}><header><div><h2>Evolução das Ordens de Serviço</h2><p>Aberturas e fechamentos reais no CHERP por período</p></div><select value={granularidade} onChange={(e) => setGranularidade(e.target.value as DashboardGranularidade)}><option value="diario">Diário</option><option value="semanal">Semanal</option><option value="mensal">Mensal</option></select></header><div className={styles.legendInline}><span className={styles.openMark} />Abertas <span className={styles.doneMark} />Fechadas</div><EvolutionChart series={data.evolucao} /></article>
      <article className={styles.panel}><header><div><h2>Situação do documento</h2><p>Distribuição de ORDEMSERVICO.SITUACAO no CHERP</p></div></header><Donut total={data.total} counts={data.countsBySituacaoDocumento} /></article>
    </section>
    <section className={styles.bottomGrid}>
      <article className={styles.panel}><header><div><h2>Ordens que exigem atenção</h2><p>Prioridade alta, urgente ou aguardando há mais tempo</p></div><button className={styles.secondaryButton} onClick={() => navigate('/os')}>Ver todas</button></header>{data.atencao.length ? <div className={styles.attentionTable}><div className={styles.attentionHead}><span># OS</span><span>Cliente</span><span>Status</span><span>Prioridade</span><span>Dias</span><span /></div>{data.atencao.map((os) => <button key={os.id} onClick={() => navigate(`/os/${os.id}`)} aria-label={`Abrir OS ${os.numero} de ${os.clienteNome || 'cliente não identificado'}`}><span className={styles.attentionNumber}>#{String(os.numero).padStart(6, '0')}</span><span className={styles.attentionClient}>{os.clienteNome || 'Cliente não identificado'}</span><span className={styles.attentionStatus}><StatusBadge status={os.status} /></span><span className={styles.attentionPriority}><PriorityBadge priority={os.prioridade} /></span><span className={`${styles.attentionDays} ${os.dias > 7 ? styles.overdue : ''}`}><span className={styles.mobileOnly}>Dias: </span>{os.dias}</span><span className={styles.attentionChevron} aria-hidden="true">›</span></button>)}</div> : <EmptyState title="Nenhuma OS exige atenção" description="Não há prioridades altas ou OS aguardando neste período." />}</article>
      <article className={styles.panel}><header><div><h2>Prioridade das Ordens</h2><p>Distribuição de prioridade no período</p></div></header><div className={styles.priorityChart}>{PRIORITY_ORDER.map((priority) => { const value = data.countsByPrioridade[priority]; const max = Math.max(1, ...PRIORITY_ORDER.map((key) => data.countsByPrioridade[key])); return <div key={priority}><strong>{value}</strong><span className={`${styles.priorityBar} ${styles[`priority${priority}`]}`} style={{ height: `${Math.max(8, (value / max) * 150)}px` }} /><small>{OS_PRIORITY_CONFIG[priority].label}</small></div>; })}</div></article>
    </section>
  </div>;
}
