import type { OSHistoricoEntry, OSPrioridade, OSStatus } from '../types/cherp.types.js';

interface OSItemProdutoBase {
  produtoCodigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
}

interface OSItemServicoBase {
  servicoCodigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
}

/** Nunca inclui preco/desconto/total/custo/faturamento. Servido a perfis sem FINANCIAL_VIEW. */
export interface OperationalOSDTO {
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
  produtos: OSItemProdutoBase[];
  servicos: OSItemServicoBase[];
  historico: OSHistoricoEntry[];
  dataAbertura: string;
  dataPrevista?: string;
  dataConclusao?: string;
  nroDav?: string;
  kmAtual?: number;
  kmFinal?: number;
}

/** Superset do OperationalOSDTO com campos financeiros. Servido só a perfis com FINANCIAL_VIEW. */
export interface AdminOSDTO extends OperationalOSDTO {
  produtos: (OSItemProdutoBase & { precoUnitario?: number; desconto?: number; total?: number })[];
  servicos: (OSItemServicoBase & { valorUnitario?: number; desconto?: number; total?: number })[];
  faturamento?: number;
  frete?: number;
  totalIpi?: number;
}
