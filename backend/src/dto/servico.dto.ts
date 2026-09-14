/** Nunca inclui valorUnitario. Servido a perfis sem FINANCIAL_VIEW. */
export interface OperationalServicoDTO {
  codigo: string;
  descricao: string;
  unidade: string;
}

/** Servido só a perfis com FINANCIAL_VIEW. */
export interface AdminServicoDTO extends OperationalServicoDTO {
  valorUnitario?: number;
}
