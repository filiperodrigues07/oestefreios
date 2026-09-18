import type {
  AdminDashboardDTO,
  OSSummaryDTO,
  OperationalDashboardDTO,
  RankingItem,
  TecnicoCount,
  DashboardAtencaoDTO,
  DashboardGranularidade,
  DashboardOperacionalDTO,
  DashboardSerieDTO,
} from '../dto/dashboard.dto.js';
import { clienteRepository, osRepository } from '../repositories/index.js';
import type { AuthenticatedUser, Permission } from '../types/auth.types.js';
import type { OrdemServico, OSPrioridade, OSStatus } from '../types/cherp.types.js';

const STATUS_VALUES: OSStatus[] = [
  'ABERTA',
  'EM_ANALISE',
  'EM_ANDAMENTO',
  'AGUARDANDO_PECA',
  'AGUARDANDO_CLIENTE',
  'CONCLUIDA',
  'CANCELADA',
];

const PRIORIDADE_VALUES: OSPrioridade[] = ['BAIXA', 'NORMAL', 'MEDIA', 'ALTA', 'URGENTE'];
const SITUACAO_DOCUMENTO_VALUES = [0, 1, 2, 3, 4, 5, 6] as const;

function zeroedStatusCounts(): Record<OSStatus, number> {
  return Object.fromEntries(STATUS_VALUES.map((s) => [s, 0])) as Record<OSStatus, number>;
}

function zeroedPrioridadeCounts(): Record<OSPrioridade, number> {
  return Object.fromEntries(PRIORIDADE_VALUES.map((p) => [p, 0])) as Record<OSPrioridade, number>;
}

function zeroedSituacaoDocumentoCounts(): Record<number, number> {
  return Object.fromEntries(SITUACAO_DOCUMENTO_VALUES.map((situacao) => [situacao, 0]));
}

/** Compatibilidade para OS antigas registradas antes da situação de atendimento passar a ser nativa. */
function nativeStatus(status: OSStatus): OSStatus {
  return status === 'EM_ANALISE' || status === 'EM_ANDAMENTO' ? 'ABERTA' : status;
}

function rankTop(items: Map<string, RankingItem>, limit: number): RankingItem[] {
  return [...items.values()].sort((a, b) => b.quantidade - a.quantidade).slice(0, limit);
}

async function getAllOS(): Promise<OrdemServico[]> {
  const { items } = await osRepository.listar({ limit: 1000 });
  return items;
}

export async function getAdminDashboard(permissions: Permission[]): Promise<AdminDashboardDTO> {
  const todasOS = await getAllOS();

  const countsByStatus = zeroedStatusCounts();
  const countsByPrioridade = zeroedPrioridadeCounts();
  const porTecnicoMap = new Map<string, number>();
  const produtosMap = new Map<string, RankingItem>();
  const servicosMap = new Map<string, RankingItem>();

  let somaHorasConclusao = 0;
  let qtdConcluidasComData = 0;

  for (const os of todasOS) {
    countsByStatus[nativeStatus(os.status)]++;
    countsByPrioridade[os.prioridade]++;

    if (os.tecnicoId) {
      porTecnicoMap.set(os.tecnicoId, (porTecnicoMap.get(os.tecnicoId) ?? 0) + 1);
    }

    for (const p of os.produtos) {
      const atual = produtosMap.get(p.produtoCodigo);
      produtosMap.set(p.produtoCodigo, {
        codigo: p.produtoCodigo,
        descricao: p.descricao,
        quantidade: (atual?.quantidade ?? 0) + p.quantidade,
      });
    }

    for (const s of os.servicos) {
      const atual = servicosMap.get(s.servicoCodigo);
      servicosMap.set(s.servicoCodigo, {
        codigo: s.servicoCodigo,
        descricao: s.descricao,
        quantidade: (atual?.quantidade ?? 0) + s.quantidade,
      });
    }

    if (os.status === 'CONCLUIDA' && os.dataConclusao) {
      const horas = (new Date(os.dataConclusao).getTime() - new Date(os.dataAbertura).getTime()) / 3_600_000;
      somaHorasConclusao += horas;
      qtdConcluidasComData++;
    }
  }

  const porTecnico: TecnicoCount[] = [...porTecnicoMap.entries()]
    .map(([tecnicoId, count]) => ({ tecnicoId, count }))
    .sort((a, b) => b.count - a.count);

  const dashboard: AdminDashboardDTO = {
    countsByStatus,
    countsByPrioridade,
    porTecnico,
    tempoMedioConclusaoHoras: qtdConcluidasComData > 0 ? somaHorasConclusao / qtdConcluidasComData : null,
    produtosMaisUtilizados: rankTop(produtosMap, 5),
    servicosMaisUtilizados: rankTop(servicosMap, 5),
  };

  if (permissions.includes('FINANCIAL_VIEW')) {
    const concluidasOuAndamento = todasOS.filter((os) => os.faturamento !== undefined);
    const faturamentoTotal = concluidasOuAndamento.reduce((acc, os) => acc + (os.faturamento ?? 0), 0);
    const valorProdutos = todasOS.reduce(
      (acc, os) => acc + os.produtos.reduce((s, p) => s + (p.total ?? 0), 0),
      0,
    );
    const valorServicos = todasOS.reduce(
      (acc, os) => acc + os.servicos.reduce((s, srv) => s + (srv.total ?? 0), 0),
      0,
    );
    dashboard.financeiro = {
      faturamentoTotal,
      valorProdutos,
      valorServicos,
      ticketMedio: concluidasOuAndamento.length > 0 ? faturamentoTotal / concluidasOuAndamento.length : 0,
    };
  }

  return dashboard;
}

function toSummaryDTO(os: OrdemServico): OSSummaryDTO {
  return {
    id: os.id,
    numero: os.numero,
    clienteCodigo: os.clienteCodigo,
    equipamentoCodigo: os.equipamentoCodigo,
    status: os.status,
    prioridade: os.prioridade,
    dataAbertura: os.dataAbertura,
  };
}

export async function getOperationalDashboard(usuario: AuthenticatedUser): Promise<OperationalDashboardDTO> {
  const todasOS = await getAllOS();
  const minhas = todasOS.filter((os) => os.tecnicoId === usuario.id || os.responsavelId === usuario.id);

  const counts = { emAtendimento: 0, aguardando: 0, prontas: 0, encerradas: 0 };
  for (const os of minhas) {
    if (os.status === 'ABERTA' || os.status === 'EM_ANALISE' || os.status === 'EM_ANDAMENTO') counts.emAtendimento++;
    else if (os.status === 'AGUARDANDO_PECA' || os.status === 'AGUARDANDO_CLIENTE') counts.aguardando++;
    else if (os.status === 'CONCLUIDA') counts.prontas++;
    else if (os.status === 'CANCELADA') counts.encerradas++;
  }

  const minhasOS = minhas
    .sort((a, b) => new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime())
    .slice(0, 20)
    .map(toSummaryDTO);

  return { counts, minhasOS };
}

export function startOfDay(value: Date): Date {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function endOfDay(value: Date): Date {
  const result = new Date(value);
  result.setHours(23, 59, 59, 999);
  return result;
}

function bucketStart(value: Date, granularidade: DashboardGranularidade): Date {
  const date = startOfDay(value);
  if (granularidade === 'mensal') return new Date(date.getFullYear(), date.getMonth(), 1);
  if (granularidade === 'semanal') {
    const day = date.getDay();
    date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  }
  return date;
}

function bucketKey(value: Date, granularidade: DashboardGranularidade): string {
  const date = bucketStart(value, granularidade);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function bucketLabel(value: Date, granularidade: DashboardGranularidade): string {
  if (granularidade === 'mensal') return value.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
  if (granularidade === 'semanal') return `Sem. ${value.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
  return value.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function buildSeries(inicio: Date, fim: Date, granularidade: DashboardGranularidade): DashboardSerieDTO[] {
  const series: DashboardSerieDTO[] = [];
  const cursor = bucketStart(inicio, granularidade);
  const final = bucketStart(fim, granularidade);
  while (cursor <= final) {
    const start = new Date(cursor);
    series.push({ chave: bucketKey(start, granularidade), rotulo: bucketLabel(start, granularidade), abertas: 0, encerradas: 0 });
    if (granularidade === 'mensal') cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + (granularidade === 'semanal' ? 7 : 1));
  }
  return series;
}

/** Dashboard operacional por período, sem métricas financeiras e sem carregar itens da OS. */
export async function getOperationalDashboardV2(input: {
  inicio: Date;
  fim: Date;
  granularidade: DashboardGranularidade;
}): Promise<DashboardOperacionalDTO> {
  const inicio = startOfDay(input.inicio);
  const fim = endOfDay(input.fim);
  const osDoPeriodo = await osRepository.listarParaDashboard({ dataInicial: inicio, dataFinal: fim });
  const abertasNoPeriodo = osDoPeriodo.filter((os) => {
    const data = new Date(os.dataAbertura).getTime();
    return data >= inicio.getTime() && data <= fim.getTime();
  });
  const countsByStatus = zeroedStatusCounts();
  const countsBySituacaoDocumento = zeroedSituacaoDocumentoCounts();
  const countsByPrioridade = zeroedPrioridadeCounts();
  const evolucao = buildSeries(inicio, fim, input.granularidade);
  const bucketMap = new Map(evolucao.map((item) => [item.chave, item]));

  for (const os of abertasNoPeriodo) {
    countsByStatus[nativeStatus(os.status)]++;
    if (os.situacaoDocumento !== undefined) countsBySituacaoDocumento[os.situacaoDocumento] = (countsBySituacaoDocumento[os.situacaoDocumento] ?? 0) + 1;
    countsByPrioridade[os.prioridade]++;
    const bucket = bucketMap.get(bucketKey(new Date(os.dataAbertura), input.granularidade));
    if (bucket) bucket.abertas++;
  }
  for (const os of osDoPeriodo) {
    if (!os.dataConclusao) continue;
    const dataConclusao = new Date(os.dataConclusao);
    if (dataConclusao < inicio || dataConclusao > fim) continue;
    const bucket = bucketMap.get(bucketKey(dataConclusao, input.granularidade));
    if (bucket) bucket.encerradas++;
  }

  const agora = Date.now();
  const altas = abertasNoPeriodo.filter((os) => os.prioridade === 'ALTA' || os.prioridade === 'URGENTE');
  const aguardando = abertasNoPeriodo.filter((os) => os.status === 'AGUARDANDO_PECA' || os.status === 'AGUARDANDO_CLIENTE');
  const atencaoMap = new Map<string, OrdemServico>();
  [...altas, ...aguardando]
    .sort((a, b) => new Date(a.dataAbertura).getTime() - new Date(b.dataAbertura).getTime())
    .forEach((os) => atencaoMap.set(os.id, os));
  const atencao: DashboardAtencaoDTO[] = [...atencaoMap.values()].slice(0, 5).map((os) => ({
    id: os.id,
    numero: os.numero,
    clienteNome: os.clienteNome,
    status: os.status,
    prioridade: os.prioridade,
    dias: Math.max(0, Math.floor((agora - new Date(os.dataAbertura).getTime()) / 86_400_000)),
  }));

  return {
    periodo: { inicio: inicio.toISOString(), fim: fim.toISOString(), granularidade: input.granularidade },
    total: abertasNoPeriodo.length,
    countsByStatus,
    countsBySituacaoDocumento,
    countsByPrioridade,
    evolucao,
    atencao,
  };
}

export interface DashboardSearchResult {
  tipo: 'OS' | 'CLIENTE';
  id: string;
  titulo: string;
  descricao: string;
}

/** Busca global limitada: OS por número/cliente/placa e clientes por código ou nome. */
export async function searchDashboard(termo: string): Promise<DashboardSearchResult[]> {
  const [ordens, clientes] = await Promise.all([
    osRepository.buscarParaDashboard(termo),
    clienteRepository.buscar({ codigo: /^\d+$/.test(termo) ? termo : undefined, descricao: /^\d+$/.test(termo) ? undefined : termo, limit: 5 }),
  ]);
  return [
    ...ordens.map((os) => ({ tipo: 'OS' as const, id: os.id, titulo: `OS #${String(os.numero).padStart(6, '0')}`, descricao: [os.clienteNome || os.clienteCodigo, os.equipamentoDescricao].filter(Boolean).join(' · ') || 'Ordem de serviço' })),
    ...clientes.items.map((cliente) => ({ tipo: 'CLIENTE' as const, id: cliente.codigo, titulo: cliente.nome, descricao: cliente.documento || `Cliente ${cliente.codigo}` })),
  ].slice(0, 10);
}
