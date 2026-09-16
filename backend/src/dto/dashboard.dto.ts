import type { OSPrioridade, OSStatus } from '../types/cherp.types.js';

export interface RankingItem {
  codigo: string;
  descricao: string;
  quantidade: number;
}

export interface TecnicoCount {
  tecnicoId: string;
  count: number;
}

/** Indicadores financeiros — só presentes no DTO quando o perfil tem FINANCIAL_VIEW. */
export interface DashboardFinanceiro {
  faturamentoTotal: number;
  valorProdutos: number;
  valorServicos: number;
  ticketMedio: number;
}

export interface AdminDashboardDTO {
  countsByStatus: Record<OSStatus, number>;
  countsByPrioridade: Record<OSPrioridade, number>;
  porTecnico: TecnicoCount[];
  tempoMedioConclusaoHoras: number | null;
  produtosMaisUtilizados: RankingItem[];
  servicosMaisUtilizados: RankingItem[];
  financeiro?: DashboardFinanceiro;
}

export type DashboardGranularidade = 'diario' | 'semanal' | 'mensal';

export interface DashboardPeriodoDTO {
  inicio: string;
  fim: string;
  granularidade: DashboardGranularidade;
}

export interface DashboardSerieDTO {
  chave: string;
  rotulo: string;
  abertas: number;
  concluidas: number;
}

export interface DashboardAtencaoDTO {
  id: string;
  numero: number;
  clienteNome?: string;
  status: OSStatus;
  prioridade: OSPrioridade;
  dias: number;
}

export interface DashboardOperacionalDTO {
  periodo: DashboardPeriodoDTO;
  total: number;
  countsByStatus: Record<OSStatus, number>;
  countsByPrioridade: Record<OSPrioridade, number>;
  evolucao: DashboardSerieDTO[];
  atencao: DashboardAtencaoDTO[];
}

/** Linha resumida de OS pro dashboard operacional — nunca carrega produto/serviço/valor. */
export interface OSSummaryDTO {
  id: string;
  numero: number;
  clienteCodigo: string;
  equipamentoCodigo: string;
  status: OSStatus;
  prioridade: OSPrioridade;
  dataAbertura: string;
}

export interface OperationalDashboardDTO {
  counts: {
    pendentes: number;
    emAndamento: number;
    aguardando: number;
    concluidas: number;
  };
  minhasOS: OSSummaryDTO[];
}
