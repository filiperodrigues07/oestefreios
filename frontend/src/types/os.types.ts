export type OSStatus =
  | 'ABERTA'
  | 'EM_ANALISE'
  | 'EM_ANDAMENTO'
  | 'AGUARDANDO_PECA'
  | 'AGUARDANDO_CLIENTE'
  | 'CONCLUIDA'
  | 'CANCELADA';

export type OSPrioridade = 'BAIXA' | 'NORMAL' | 'ALTA' | 'URGENTE';

export interface OSItemProduto {
  produtoCodigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  precoUnitario?: number;
  desconto?: number;
  total?: number;
}

export interface OSItemServico {
  servicoCodigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  valorUnitario?: number;
  desconto?: number;
  total?: number;
}

export interface OSHistoricoEntry {
  timestamp: string;
  evento: string;
  usuarioNome: string;
}

/** Espelha backend/src/dto/os.dto.ts. Campos financeiros (precoUnitario/valorUnitario/total/faturamento)
 * só existem quando o backend os envia (perfil com FINANCIAL_VIEW) — nunca assuma presentes. */
export interface OrdemServicoDTO {
  id: string;
  numero: number;
  clienteCodigo: string;
  equipamentoCodigo: string;
  status: OSStatus;
  prioridade: OSPrioridade;
  responsavelId?: string;
  tecnicoId?: string;
  problema: string;
  diagnostico?: string;
  observacoes?: string;
  solucao?: string;
  produtos: OSItemProduto[];
  servicos: OSItemServico[];
  historico: OSHistoricoEntry[];
  dataAbertura: string;
  dataPrevista?: string;
  dataConclusao?: string;
  faturamento?: number;
}

/**
 * Espelha backend/src/services/osWorkflow.ts. Só para filtrar opções na UI —
 * o backend sempre revalida a transição, esta cópia nunca é a fonte de verdade.
 */
export const ALLOWED_TRANSITIONS: Record<OSStatus, OSStatus[]> = {
  ABERTA: ['EM_ANALISE', 'CANCELADA'],
  EM_ANALISE: ['EM_ANDAMENTO', 'ABERTA', 'CANCELADA'],
  EM_ANDAMENTO: ['AGUARDANDO_PECA', 'AGUARDANDO_CLIENTE', 'CONCLUIDA', 'CANCELADA'],
  AGUARDANDO_PECA: ['EM_ANDAMENTO', 'CANCELADA'],
  AGUARDANDO_CLIENTE: ['EM_ANDAMENTO', 'CANCELADA'],
  CONCLUIDA: [],
  CANCELADA: [],
};
