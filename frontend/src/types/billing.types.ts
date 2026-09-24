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

export type ModoAssinatura = 'AUTO' | 'SUSPENSO' | 'LIBERADO';

export interface BillingStatusDTO {
  estado: EstadoAssinatura;
  diasParaVencer: number | null;
  mensagem: string;
  /** Só o proprietário recebe: DATA = pelo vencimento; MANUAL = suspensão/liberação dele. */
  origem?: 'DATA' | 'MANUAL';
}

export interface BillingDTO extends BillingStatusDTO {
  cliente: string;
  plano: string;
  valorMensal: number;
  vencimentoAtual: string | null;
  diaVencimento: number;
  carenciaDias: number;
  avisoDias: number;
  observacaoInterna: string;
  mensagemCliente: string;
  modo: ModoAssinatura;
  liberadoAte: string | null;
  controleMotivo: string;
  controlePor: string;
  controleEm: string | null;
  cobrancas: CobrancaDTO[];
  pagamentos: PagamentoAssinaturaDTO[];
}

export type BillingUpdateInput = Pick<
  BillingDTO,
  'cliente' | 'plano' | 'valorMensal' | 'vencimentoAtual' | 'diaVencimento' | 'carenciaDias' | 'avisoDias' | 'observacaoInterna' | 'mensagemCliente'
>;

export interface ControleAssinaturaInput {
  acao: 'SUSPENDER' | 'LIBERAR' | 'AUTOMATICO';
  motivo: string;
  liberadoAte?: string | null;
  mensagemCliente?: string;
}

export interface NovoPagamentoInput {
  data: string;
  referencia: string;
  valor: number;
  forma: 'PIX' | 'BOLETO' | 'DINHEIRO' | 'OUTRO';
  observacao: string;
  cobrancaId?: string;
}

export interface CobrancaDTO {
  id: string;
  referencia: string;
  vencimento: string;
  valor: number;
  observacao: string;
  arquivoNome: string;
  arquivoTamanho: number;
  criadoEm: string;
  criadoPor: string;
  enviadoEm: string | null;
  enviadoPara: string[];
  envios: number;
  pagoEm: string | null;
}

export interface CobrancaSmtpDTO {
  host: string;
  port: number;
  seguranca: 'nenhuma' | 'starttls' | 'ssl';
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

export interface CobrancaConfigDTO {
  emails: string[];
  copiaOculta: string;
  smtp: CobrancaSmtpDTO;
}
