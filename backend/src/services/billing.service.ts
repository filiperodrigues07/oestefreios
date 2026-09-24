import { randomUUID } from 'node:crypto';
import { AppError } from '../errors/AppError.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import type { AuthenticatedUser } from '../types/auth.types.js';
import type { RequestContext } from '../utils/requestContext.js';
import { recordAudit } from './auditLog.service.js';
import { readCategory, writeCategory } from './settings.service.js';

/**
 * Mensalidade do cliente. Guardada em `settings` (categoria `billing`, jsonb) — só o proprietário
 * (super admin) lê/edita. Sem vencimento configurado = EM_DIA (nunca trava um sistema recém-instalado).
 * O controle manual (suspender/liberar) tem precedência sobre a data.
 */

export type EstadoAssinatura = 'EM_DIA' | 'A_VENCER' | 'VENCIDA' | 'SOMENTE_LEITURA';
export type ModoAssinatura = 'AUTO' | 'SUSPENSO' | 'LIBERADO';

export interface PagamentoAssinatura {
  id: string;
  data: string;
  referencia: string;
  valor: number;
  forma: string;
  observacao: string;
  registradoPor: string;
}

export interface BillingSettings {
  cliente: string;
  plano: string;
  valorMensal: number;
  vencimentoAtual: string | null;
  diaVencimento: number;
  carenciaDias: number;
  avisoDias: number;
  /** Nota interna do proprietário — nunca sai daqui para o cliente. */
  observacaoInterna: string;
  /** Texto mostrado ao cliente no banner de somente leitura (vazio = mensagem padrão). */
  mensagemCliente: string;
  modo: ModoAssinatura;
  /** Só em LIBERADO: até quando a liberação vale (null = sem prazo). */
  liberadoAte: string | null;
  controleMotivo: string;
  controlePor: string;
  controleEm: string | null;
  pagamentos: PagamentoAssinatura[];
}

export interface BillingStatus {
  estado: EstadoAssinatura;
  diasParaVencer: number | null;
  mensagem: string;
  /** DATA = calculado pelo vencimento; MANUAL = suspensão/liberação do proprietário. */
  origem: 'DATA' | 'MANUAL';
}

const BILLING_PADRAO: BillingSettings = {
  cliente: '',
  plano: '',
  valorMensal: 0,
  vencimentoAtual: null,
  diaVencimento: 10,
  carenciaDias: 5,
  avisoDias: 7,
  observacaoInterna: '',
  mensagemCliente: '',
  modo: 'AUTO',
  liberadoAte: null,
  controleMotivo: '',
  controlePor: '',
  controleEm: null,
  pagamentos: [],
};

const MENSAGEM_SOMENTE_LEITURA = 'Sistema em modo consulta — não é possível salvar alterações no momento. Fale com o suporte.';

function paraUtc(dataIso: string): number {
  const [ano, mes, dia] = dataIso.split('-').map(Number) as [number, number, number];
  return Date.UTC(ano, mes - 1, dia);
}

/** Data de hoje (YYYY-MM-DD) no fuso da oficina, não no UTC do servidor. */
export function hojeIso(agora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora);
}

/** Função pura: dias > 0 faltam, < 0 atraso. */
export function calcularEstadoAssinatura(input: {
  vencimento: string | null;
  hoje: string;
  carenciaDias: number;
  avisoDias: number;
}): { estado: EstadoAssinatura; diasParaVencer: number | null } {
  if (!input.vencimento) return { estado: 'EM_DIA', diasParaVencer: null };
  const dias = Math.round((paraUtc(input.vencimento) - paraUtc(input.hoje)) / 86_400_000);
  if (dias > input.avisoDias) return { estado: 'EM_DIA', diasParaVencer: dias };
  if (dias >= 0) return { estado: 'A_VENCER', diasParaVencer: dias };
  if (-dias <= input.carenciaDias) return { estado: 'VENCIDA', diasParaVencer: dias };
  return { estado: 'SOMENTE_LEITURA', diasParaVencer: dias };
}

/**
 * Precedência do controle manual sobre o cálculo por data (pura, testável):
 * SUSPENSO → somente leitura já; LIBERADO (dentro do prazo) → em dia mesmo vencido; LIBERADO vencido volta ao automático.
 */
export function aplicarControleManual(
  base: { estado: EstadoAssinatura; diasParaVencer: number | null },
  controle: { modo: ModoAssinatura; liberadoAte: string | null },
  hoje: string,
): { estado: EstadoAssinatura; diasParaVencer: number | null; origem: 'DATA' | 'MANUAL' } {
  if (controle.modo === 'SUSPENSO') return { estado: 'SOMENTE_LEITURA', diasParaVencer: base.diasParaVencer, origem: 'MANUAL' };
  if (controle.modo === 'LIBERADO' && (!controle.liberadoAte || paraUtc(hoje) <= paraUtc(controle.liberadoAte))) {
    return { estado: 'EM_DIA', diasParaVencer: base.diasParaVencer, origem: 'MANUAL' };
  }
  return { ...base, origem: 'DATA' };
}

/** Soma um mês respeitando o dia de vencimento e o fim de mês (dia 31 em fevereiro cai no dia 28/29). */
export function proximoVencimento(base: string, diaVencimento: number): string {
  const [ano, mes] = base.split('-').map(Number) as [number, number];
  const proximoMes = mes === 12 ? 1 : mes + 1;
  const proximoAno = mes === 12 ? ano + 1 : ano;
  const ultimoDia = new Date(Date.UTC(proximoAno, proximoMes, 0)).getUTCDate();
  const dia = Math.min(diaVencimento, ultimoDia);
  return `${proximoAno}-${String(proximoMes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function mensagemPara(estado: EstadoAssinatura, dias: number | null, mensagemCliente: string): string {
  if (estado === 'A_VENCER') return dias === 0 ? 'A mensalidade vence hoje.' : `A mensalidade vence em ${dias} dia(s).`;
  if (estado === 'VENCIDA') return `Mensalidade vencida há ${Math.abs(dias ?? 0)} dia(s). Regularize para evitar o bloqueio de alterações.`;
  if (estado === 'SOMENTE_LEITURA') return mensagemCliente.trim() || MENSAGEM_SOMENTE_LEITURA;
  return '';
}

export async function getBilling(): Promise<BillingSettings> {
  return readCategory('billing', BILLING_PADRAO);
}

function statusDe(dados: BillingSettings, agora = new Date()): BillingStatus {
  const hoje = hojeIso(agora);
  const base = calcularEstadoAssinatura({
    vencimento: dados.vencimentoAtual,
    hoje,
    carenciaDias: dados.carenciaDias,
    avisoDias: dados.avisoDias,
  });
  const { estado, diasParaVencer, origem } = aplicarControleManual(base, { modo: dados.modo, liberadoAte: dados.liberadoAte }, hoje);
  return { estado, diasParaVencer, origem, mensagem: mensagemPara(estado, diasParaVencer, dados.mensagemCliente) };
}

let cache: { status: BillingStatus; em: number } | null = null;
const CACHE_MS = 60_000;

export function invalidarCacheBilling(): void {
  cache = null;
}

/** Estado atual com cache de 60 s — usado pelo middleware de autenticação em toda requisição de escrita. */
export async function getBillingStatus(): Promise<BillingStatus> {
  if (cache && Date.now() - cache.em < CACHE_MS) return cache.status;
  const status = statusDe(await getBilling());
  cache = { status, em: Date.now() };
  return status;
}

/**
 * Visão do status para quem NÃO é o proprietário: só existe "modo consulta" ou nada. Aviso de vencimento,
 * carência e origem são assunto do proprietário — o cliente não os vê.
 */
export function statusParaCliente(status: BillingStatus): Omit<BillingStatus, 'origem'> {
  if (status.estado === 'SOMENTE_LEITURA') return { estado: 'SOMENTE_LEITURA', diasParaVencer: null, mensagem: status.mensagem };
  return { estado: 'EM_DIA', diasParaVencer: null, mensagem: '' };
}

export async function getBillingCompleto(): Promise<BillingSettings & BillingStatus> {
  const dados = await getBilling();
  return { ...dados, ...statusDe(dados) };
}

export function erroSomenteLeitura(mensagem?: string): AppError {
  return new AppError('SUBSCRIPTION_READ_ONLY', mensagem ?? MENSAGEM_SOMENTE_LEITURA, 403);
}

function auditBilling(event: string, usuario: AuthenticatedUser, ctx: RequestContext, changes: unknown) {
  return recordAudit({ userId: usuario.id, userName: usuario.name, event, entityType: 'BILLING', entityId: event, changes, ...ctx });
}

export type BillingUpdateInput = Pick<
  BillingSettings,
  'cliente' | 'plano' | 'valorMensal' | 'vencimentoAtual' | 'diaVencimento' | 'carenciaDias' | 'avisoDias' | 'observacaoInterna' | 'mensagemCliente'
>;

export async function atualizarBilling(input: BillingUpdateInput, usuario: AuthenticatedUser, ctx: RequestContext) {
  const atual = await getBilling();
  await writeCategory('billing', { ...atual, ...input });
  invalidarCacheBilling();
  const { pagamentos: _ignorado, ...antes } = atual;
  await auditBilling('BILLING_UPDATED', usuario, ctx, { before: antes, after: input });
  return getBillingCompleto();
}

export interface ControleAssinaturaInput {
  acao: 'SUSPENDER' | 'LIBERAR' | 'AUTOMATICO';
  motivo: string;
  liberadoAte?: string | null;
  mensagemCliente?: string;
}

/** Suspende, libera (com prazo opcional) ou devolve ao cálculo por data. Sempre com motivo, sempre auditado. */
export async function controlarAssinatura(input: ControleAssinaturaInput, usuario: AuthenticatedUser, ctx: RequestContext) {
  const atual = await getBilling();
  const modo: ModoAssinatura = input.acao === 'SUSPENDER' ? 'SUSPENSO' : input.acao === 'LIBERAR' ? 'LIBERADO' : 'AUTO';
  const proximo: BillingSettings = {
    ...atual,
    modo,
    liberadoAte: modo === 'LIBERADO' ? (input.liberadoAte ?? null) : null,
    mensagemCliente: input.mensagemCliente !== undefined ? input.mensagemCliente : atual.mensagemCliente,
    controleMotivo: input.motivo,
    controlePor: usuario.name,
    controleEm: new Date().toISOString(),
  };
  await writeCategory('billing', proximo);
  invalidarCacheBilling();
  await auditBilling('BILLING_CONTROL', usuario, ctx, {
    acao: input.acao,
    motivo: input.motivo,
    modoAnterior: atual.modo,
    modo,
    liberadoAte: proximo.liberadoAte,
  });
  return getBillingCompleto();
}

export interface NovoPagamentoInput {
  data: string;
  referencia: string;
  valor: number;
  forma: string;
  observacao: string;
}

/** Registra o pagamento e avança o vencimento em 1 mês (a partir do vencimento atual, ou da data paga se não houver). */
export async function registrarPagamento(input: NovoPagamentoInput, usuario: AuthenticatedUser, ctx: RequestContext) {
  const atual = await getBilling();
  const pagamento: PagamentoAssinatura = { id: randomUUID(), ...input, registradoPor: usuario.name };
  const vencimentoAtual = proximoVencimento(atual.vencimentoAtual ?? input.data, atual.diaVencimento);
  await writeCategory('billing', { ...atual, vencimentoAtual, pagamentos: [pagamento, ...atual.pagamentos] });
  invalidarCacheBilling();
  await auditBilling('BILLING_PAYMENT_ADDED', usuario, ctx, { pagamento, vencimentoAnterior: atual.vencimentoAtual, vencimentoAtual });
  return getBillingCompleto();
}

/** Só corrige o histórico; o vencimento se ajusta manualmente em "Editar dados". */
export async function removerPagamento(id: string, usuario: AuthenticatedUser, ctx: RequestContext) {
  const atual = await getBilling();
  const removido = atual.pagamentos.find((item) => item.id === id);
  if (!removido) throw new NotFoundError('Pagamento não encontrado.', 'BILLING_PAYMENT_NOT_FOUND');
  await writeCategory('billing', { ...atual, pagamentos: atual.pagamentos.filter((item) => item.id !== id) });
  invalidarCacheBilling();
  await auditBilling('BILLING_PAYMENT_REMOVED', usuario, ctx, { pagamento: removido });
  return getBillingCompleto();
}
