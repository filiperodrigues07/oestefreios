/**
 * Entidades do domínio CHERP/Firebird. `codigo` é sempre string: o CHERP
 * usa códigos com zeros à esquerda (ex. "00012345") que não podem virar number.
 */

export interface Produto {
  codigo: string;
  descricao: string;
  unidade: string;
  categoria?: string;
  disponivel?: number;
  estoqueMinimo?: number;
  precoUnitario?: number;
  custo?: number;
}

export interface Servico {
  codigo: string;
  descricao: string;
  unidade: string;
  categoria?: string;
  valorUnitario?: number;
}

export type TipoPessoa = 'PF' | 'PJ';

export interface Cliente {
  codigo: string;
  /** Nome de exibição — fantasia se houver, senão razão social/nome completo. Uso em listas/busca. */
  nome: string;
  documento?: string;
  telefone?: string;
  tipoPessoa?: TipoPessoa;
  /** Razão social (PJ) ou nome completo (PF) — bruto, sem coalescer com fantasia. Uso em formulário de edição. */
  razaoSocial?: string;
  nomeFantasia?: string;
  email?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  complemento?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  /** CLIFOR também marca fornecedor/transportador/representante de forma independente de cliente (Fase A0). */
  fornecedor?: boolean;
  transportador?: boolean;
  representante?: boolean;
  /** CRT (Código de Regime Tributário) padrão SEFAZ/NFe: 1=Simples Nacional, 2=Simples excesso sublimite, 3=Regime Normal. 0/undefined=não definido. */
  regimeTributario?: RegimeTributario;
}

export type RegimeTributario = 0 | 1 | 2 | 3;

/** Entrada pra criar/editar cliente — `documento` sempre exigido (CPF ou CNPJ conforme `tipoPessoa`). */
export interface ClienteInput {
  tipoPessoa: TipoPessoa;
  nome: string;
  nomeFantasia?: string;
  documento: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  complemento?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  fornecedor?: boolean;
  transportador?: boolean;
  representante?: boolean;
  regimeTributario?: RegimeTributario;
}

export interface Equipamento {
  codigo: string;
  descricao: string;
  clienteCodigo: string;
  /** Placa do veículo — nome de campo espelha a coluna IDENTIFICACAO do CHERP. */
  identificacao?: string;
  marca?: string;
  modelo?: string;
  anoFabricacao?: string;
  anoModelo?: string;
  cor?: string;
  chassi?: string;
  kmAtual?: number;
}

/** Entrada pra criar/editar veículo. `placa` é o nome exibido na UI pro campo `identificacao`. */
export interface EquipamentoInput {
  clienteCodigo: string;
  placa: string;
  marca?: string;
  modelo?: string;
  anoFabricacao?: string;
  anoModelo?: string;
  cor?: string;
  chassi?: string;
  kmAtual?: number;
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
  faturamento?: number;
  /** Nº do DAV impresso no CHERP (ORDEMSERVICO.NRODAV) — só leitura, o CHERP quem gera. */
  nroDav?: string;
  /** KM do veículo na abertura/entrega (ORDEMSERVICO.KMATUAL/KMFINAL) — editável pelo app. */
  kmAtual?: number;
  kmFinal?: number;
  /** Frete e IPI da OS (ORDEMSERVICO.FRETE/TOTALIPI) — só leitura, financeiro. */
  frete?: number;
  totalIpi?: number;
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
  /** Só usado por clientes. */
  tipoPessoa?: TipoPessoa;
  uf?: string;
  page?: number;
  limit?: number;
  sortBy?: 'codigo' | 'descricao';
  sortOrder?: 'asc' | 'desc';
}
