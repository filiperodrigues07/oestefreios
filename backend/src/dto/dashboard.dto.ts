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
