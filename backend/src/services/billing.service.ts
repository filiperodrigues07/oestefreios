import { randomUUID } from 'node:crypto';
import { AppError } from '../errors/AppError.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import type { AuthenticatedUser } from '../types/auth.types.js';
import type { RequestContext } from '../utils/requestContext.js';
import { recordAudit } from './auditLog.service.js';
import { readCategory, writeCategory } from './settings.service.js';

/**
 * Mensalidade do cliente. Guardada em `settings` (categoria `billing`, jsonb) — só quem tem
 * SYSTEM_SETTINGS lê/edita. Sem vencimento configurado = EM_DIA (nunca trava um sistema recém-instalado).
 */

export type EstadoAssinatura = 'EM_DIA' | 'A_VENCER' | 'VENCIDA' | 'SOMENTE_LEITURA';

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
  pagamentos: PagamentoAssinatura[];
}

export interface BillingStatus {
  estado: EstadoAssinatura;
  diasParaVencer: number | null;
  mensagem: string;
}

const BILLING_PADRAO: BillingSettings = {
  cliente: '',
  plano: '',
  valorMensal: 0,
  vencimentoAtual: null,
  diaVencimento: 10,
  carenciaDias: 5,
  avisoDias: 7,
  pagamentos: [],
};

const MENSAGEM_SOMENTE_LEITURA = 'Mensalidade em atraso — o sistema está somente para consulta. Fale com o suporte.';

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

/** Soma um mês respeitando o dia de vencimento e o fim de mês (dia 31 em fevereiro cai no dia 28/29). */
export function proximoVencimento(base: string, diaVencimento: number): string {
  const [ano, mes] = base.split('-').map(Number) as [number, number];
  const proximoMes = mes === 12 ? 1 : mes + 1;
  const proximoAno = mes === 12 ? ano + 1 : ano;
  const ultimoDia = new Date(Date.UTC(proximoAno, proximoMes, 0)).getUTCDate();
  const dia = Math.min(diaVencimento, ultimoDia);
  return `${proximoAno}-${String(proximoMes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function mensagemPara(estado: EstadoAssinatura, dias: number | null): string {
  if (estado === 'A_VENCER') return dias === 0 ? 'A mensalidade vence hoje.' : `A mensalidade vence em ${dias} dia(s).`;
  if (estado === 'VENCIDA') return `Mensalidade vencida há ${Math.abs(dias ?? 0)} dia(s). Regularize para evitar o bloqueio de alterações.`;
  if (estado === 'SOMENTE_LEITURA') return MENSAGEM_SOMENTE_LEITURA;
  return '';
}

export async function getBilling(): Promise<BillingSettings> {
  return readCategory('billing', BILLING_PADRAO);
}

function statusDe(dados: BillingSettings, agora = new Date()): BillingStatus {
  const { estado, diasParaVencer } = calcularEstadoAssinatura({
    vencimento: dados.vencimentoAtual,
    hoje: hojeIso(agora),
    carenciaDias: dados.carenciaDias,
    avisoDias: dados.avisoDias,
  });
  return { estado, diasParaVencer, mensagem: mensagemPara(estado, diasParaVencer) };
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

export async function getBillingCompleto(): Promise<BillingSettings & BillingStatus> {
  const dados = await getBilling();
  return { ...dados, ...statusDe(dados) };
}

export function erroSomenteLeitura(): AppError {
  return new AppError('SUBSCRIPTION_READ_ONLY', MENSAGEM_SOMENTE_LEITURA, 403);
}

function auditBilling(event: string, usuario: AuthenticatedUser, ctx: RequestContext, changes: unknown) {
  return recordAudit({ userId: usuario.id, userName: usuario.name, event, entityType: 'BILLING', entityId: event, changes, ...ctx });
}

export type BillingUpdateInput = Omit<BillingSettings, 'pagamentos'>;

export async function atualizarBilling(input: BillingUpdateInput, usuario: AuthenticatedUser, ctx: RequestContext) {
  const atual = await getBilling();
  await writeCategory('billing', { ...input, pagamentos: atual.pagamentos });
  invalidarCacheBilling();
  const { pagamentos: _ignorado, ...antes } = atual;
  await auditBilling('BILLING_UPDATED', usuario, ctx, { before: antes, after: input });
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
