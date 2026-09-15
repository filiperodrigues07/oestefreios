import type { OSPrioridade, OSStatus } from './os.types.js';

export interface RankingItem {
  codigo: string;
  descricao: string;
  quantidade: number;
}

export interface TecnicoCount {
  tecnicoId: string;
  count: number;
}

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
