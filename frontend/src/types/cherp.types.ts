/** DTOs recebidos da API — nunca assuma campos financeiros presentes; eles só existem com FINANCIAL_VIEW. */
export interface ProdutoDTO {
  codigo: string;
  descricao: string;
  unidade: string;
  categoria?: string;
  tipo?: string;
  disponivel?: number;
  estoqueMinimo?: number;
  precoUnitario?: number;
  custo?: number;
}

export interface ServicoDTO {
  codigo: string;
  descricao: string;
  unidade: string;
  categoria?: string;
  valorUnitario?: number;
}

export type TipoPessoa = 'PF' | 'PJ';

/** CRT (Código de Regime Tributário) padrão SEFAZ/NFe: 1=Simples Nacional, 2=Simples excesso sublimite, 3=Regime Normal. */
export type RegimeTributario = 0 | 1 | 2 | 3;

export interface ClienteDTO {
  codigo: string;
  ativo?: boolean;
  nome: string;
  documento?: string;
  telefone?: string;
  celular?: string;
  tipoPessoa?: TipoPessoa;
  razaoSocial?: string;
  nomeFantasia?: string;
  email?: string;
  emailFinanceiro?: string;
  emailNfe?: string;
  homePage?: string;
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
  reducaoMva?: number;
  coreRepresentante?: string;
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

export interface ClienteInput {
  ativo?: boolean;
  tipoPessoa: TipoPessoa;
  nome: string;
  nomeFantasia?: string;
  documento: string;
  telefone?: string;
  celular?: string;
  email?: string;
  emailFinanceiro?: string;
  emailNfe?: string;
  homePage?: string;
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
  reducaoMva?: number;
  coreRepresentante?: string;
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

/** "Veículo" na interface — nome de campo espelha a coluna EQUIPAMENTOS/IDENTIFICACAO do CHERP. */
export interface EquipamentoDTO {
  codigo: string;
  descricao: string;
  clienteCodigo: string;
  identificacao?: string;
  marca?: string;
  modelo?: string;
  anoFabricacao?: string;
  anoModelo?: string;
  cor?: string;
  chassi?: string;
  kmAtual?: number;
}

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

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message: string | null;
}

export interface ApiError {
  success: false;
  error: { code: string; message: string };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
