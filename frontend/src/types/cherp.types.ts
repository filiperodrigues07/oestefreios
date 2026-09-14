/** DTOs recebidos da API — nunca assuma campos financeiros presentes; eles só existem com FINANCIAL_VIEW. */
export interface ProdutoDTO {
  codigo: string;
  descricao: string;
  unidade: string;
  disponivel?: number;
  precoUnitario?: number;
  custo?: number;
}

export interface ServicoDTO {
  codigo: string;
  descricao: string;
  unidade: string;
  valorUnitario?: number;
}

export interface ClienteDTO {
  codigo: string;
  nome: string;
  documento?: string;
  telefone?: string;
}

export interface EquipamentoDTO {
  codigo: string;
  descricao: string;
  clienteCodigo: string;
  identificacao?: string;
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
