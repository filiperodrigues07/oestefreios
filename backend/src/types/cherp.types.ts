/**
 * Entidades do domínio CHERP/Firebird. `codigo` é sempre string: o CHERP
 * usa códigos com zeros à esquerda (ex. "00012345") que não podem virar number.
 */

export interface Produto {
  codigo: string;
  descricao: string;
  unidade: string;
  disponivel?: number;
  precoUnitario?: number;
  custo?: number;
}

export interface Servico {
  codigo: string;
  descricao: string;
  unidade: string;
  valorUnitario?: number;
}

export interface Cliente {
  codigo: string;
  nome: string;
  documento?: string;
  telefone?: string;
}

export interface Equipamento {
  codigo: string;
  descricao: string;
  clienteCodigo: string;
  identificacao?: string;
}

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

export interface OrdemServico {
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

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface SearchQuery {
  codigo?: string;
  descricao?: string;
  /** Só usado por equipamentos: filtra pelo cliente já selecionado no fluxo de criação de OS. */
  clienteCodigo?: string;
  page?: number;
  limit?: number;
  sortBy?: 'codigo' | 'descricao';
  sortOrder?: 'asc' | 'desc';
}
