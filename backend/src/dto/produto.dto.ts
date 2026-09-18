/** Nunca inclui precoUnitario/custo. Servido a perfis sem FINANCIAL_VIEW. */
export interface OperationalProdutoDTO {
  codigo: string;
  descricao: string;
  unidade: string;
  categoria?: string;
  tipo?: string;
  disponivel?: number;
  estoqueMinimo?: number;
}

/** Servido só a perfis com FINANCIAL_VIEW. */
export interface AdminProdutoDTO extends OperationalProdutoDTO {
  precoUnitario?: number;
  custo?: number;
}
