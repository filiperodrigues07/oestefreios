export type EstadoAssinatura = 'EM_DIA' | 'A_VENCER' | 'VENCIDA' | 'SOMENTE_LEITURA';

export interface PagamentoAssinaturaDTO {
  id: string;
  data: string;
  referencia: string;
  valor: number;
  forma: string;
  observacao: string;
  registradoPor: string;
}

export interface BillingStatusDTO {
  estado: EstadoAssinatura;
  diasParaVencer: number | null;
  mensagem: string;
}

export interface BillingDTO extends BillingStatusDTO {
  cliente: string;
  plano: string;
  valorMensal: number;
  vencimentoAtual: string | null;
  diaVencimento: number;
  carenciaDias: number;
  avisoDias: number;
  pagamentos: PagamentoAssinaturaDTO[];
}

export type BillingUpdateInput = Omit<BillingDTO, keyof BillingStatusDTO | 'pagamentos'>;

export interface NovoPagamentoInput {
  data: string;
  referencia: string;
  valor: number;
  forma: 'PIX' | 'BOLETO' | 'DINHEIRO' | 'OUTRO';
  observacao: string;
}
