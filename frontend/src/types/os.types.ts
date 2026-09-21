export type OSStatus =
  | 'ABERTA'
  | 'EM_ANALISE'
  | 'EM_ANDAMENTO'
  | 'AGUARDANDO_PECA'
  | 'AGUARDANDO_CLIENTE'
  | 'CONCLUIDA'
  | 'CANCELADA';

export type OSPrioridade = 'BAIXA' | 'NORMAL' | 'MEDIA' | 'ALTA' | 'URGENTE';

export interface OSItemProduto {
  produtoCodigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  precoUnitario?: number;
  desconto?: number;
  total?: number;
  descricaoComplementar?: string;
}

export interface OSItemServico {
  servicoCodigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  valorUnitario?: number;
  desconto?: number;
  total?: number;
  descricaoComplementar?: string;
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
  clienteNome?: string;
  equipamentoCodigo: string;
  equipamentoDescricao?: string;
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
  situacaoDocumento?: number;
  /** "Finalizar OS" travou a edição só neste app — nunca reflete nada do CHERP. */
  travadoLocal?: boolean;
  faturamento?: number;
  nroDav?: string;
  kmAtual?: number;
  kmFinal?: number;
  frete?: number;
  totalIpi?: number;
}

/**
 * Espelha backend/src/services/osWorkflow.ts. Só para filtrar opções na UI —
 * o backend sempre revalida a transição, esta cópia nunca é a fonte de verdade.
 */
// CONCLUIDA nunca aparece nestas listas de propósito — só é alcançável pelo botão
// "Finalizar OS" dedicado (FinalizarOSButton), que avisa que trava edição antes de confirmar,
// nunca pelo select genérico de status.
export const ALLOWED_TRANSITIONS: Record<OSStatus, OSStatus[]> = {
  ABERTA: ['AGUARDANDO_PECA', 'AGUARDANDO_CLIENTE', 'CANCELADA'],
  EM_ANALISE: ['ABERTA', 'AGUARDANDO_PECA', 'AGUARDANDO_CLIENTE', 'CANCELADA'],
  EM_ANDAMENTO: ['ABERTA', 'AGUARDANDO_PECA', 'AGUARDANDO_CLIENTE', 'CANCELADA'],
  AGUARDANDO_PECA: ['ABERTA', 'CANCELADA'],
  AGUARDANDO_CLIENTE: ['ABERTA', 'CANCELADA'],
  CONCLUIDA: [],
  CANCELADA: [],
};
