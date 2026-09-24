import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AppError } from '../errors/AppError.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import { ValidationError } from '../errors/ValidationError.js';
import type { AuthenticatedUser } from '../types/auth.types.js';
import { logger } from '../utils/logger.js';
import type { RequestContext } from '../utils/requestContext.js';
import { recordAudit } from './auditLog.service.js';
import { getBilling, invalidarCacheBilling, type BillingSettings } from './billing.service.js';
import {
  buildTransport,
  decryptSecret,
  encryptSecret,
  readCategory,
  SENHA_MASCARADA,
  writeCategory,
  type SmtpSettings,
} from './settings.service.js';

/**
 * Cobrança por boleto (Banco Inter): o proprietário anexa o PDF do mês, o sistema guarda o arquivo em
 * `storage/cobrancas` (PRIVADO — fora do /api/uploads público) e envia por e-mail a partir de um SMTP
 * só do proprietário, com a lista de e-mails de cobrança do cliente e o proprietário em cópia oculta.
 */

export interface Cobranca {
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

export interface CobrancaSettings {
  emails: string[];
  copiaOculta: string;
  smtp: SmtpSettings;
}

const COBRANCA_PADRAO: CobrancaSettings = {
  emails: [],
  copiaOculta: '',
  smtp: { host: '', port: 587, seguranca: 'starttls', user: '', password: '', fromEmail: '', fromName: 'Rodrigues Tech' },
};

export const PDF_MAX_BYTES = 5 * 1024 * 1024;

function pastaCobrancas(): string {
  return resolve(process.cwd(), 'storage', 'cobrancas');
}

function caminhoDoArquivo(id: string): string {
  return resolve(pastaCobrancas(), `${id}.pdf`);
}

/** PDF de verdade começa com "%PDF-" — não confia em extensão nem Content-Type enviados pelo navegador. */
export function ehPdf(buffer: Buffer): boolean {
  return buffer.length > 8 && buffer.subarray(0, 5).toString('latin1') === '%PDF-';
}

export function nomeSeguro(nome: string): string {
  const base = nome.normalize('NFKD').replace(/[^\w.\- ]+/g, '').trim().replace(/\s+/g, '-').replace(/^\.+/, '').slice(0, 80);
  return base.toLowerCase().endsWith('.pdf') ? base : `${base || 'boleto'}.pdf`;
}

// ---------- configuração (e-mails + SMTP próprio) ----------

export async function getCobrancaSettings(): Promise<CobrancaSettings> {
  const salvo = await readCategory<Partial<CobrancaSettings>>('cobranca', {});
  const smtp = { ...COBRANCA_PADRAO.smtp, ...(salvo.smtp ?? {}) };
  return {
    emails: salvo.emails ?? [],
    copiaOculta: salvo.copiaOculta ?? '',
    smtp: { ...smtp, password: smtp.password ? decryptSecret(smtp.password) : '' },
  };
}

export async function getCobrancaSettingsMasked(): Promise<CobrancaSettings> {
  const config = await getCobrancaSettings();
  return { ...config, smtp: { ...config.smtp, password: config.smtp.password ? SENHA_MASCARADA : '' } };
}

export async function getCobrancaSmtpPassword(): Promise<string> {
  return (await getCobrancaSettings()).smtp.password;
}

export async function saveCobrancaSettings(input: CobrancaSettings, usuario: AuthenticatedUser, ctx: RequestContext): Promise<CobrancaSettings> {
  const atual = await getCobrancaSettings();
  const password = !input.smtp.password || input.smtp.password === SENHA_MASCARADA ? atual.smtp.password : input.smtp.password;
  await writeCategory('cobranca', { ...input, smtp: { ...input.smtp, password: encryptSecret(password) } });
  await recordAudit({
    userId: usuario.id,
    userName: usuario.name,
    event: 'BILLING_COBRANCA_CONFIG',
    entityType: 'BILLING',
    entityId: 'BILLING_COBRANCA_CONFIG',
    changes: { emails: input.emails, copiaOculta: input.copiaOculta, smtpHost: input.smtp.host, smtpUser: input.smtp.user, senhaAlterada: password !== atual.smtp.password },
    ...ctx,
  });
  return getCobrancaSettingsMasked();
}

function assertSmtp(config: CobrancaSettings): void {
  if (!config.smtp.host || !config.smtp.fromEmail) {
    throw new ValidationError('Configure o e-mail de cobrança (SMTP) antes de enviar.');
  }
}

export async function testarSmtpCobranca(destino: string): Promise<{ ok: boolean; message: string }> {
  const config = await getCobrancaSettings();
  try {
    assertSmtp(config);
    await comTimeout(buildTransport(config.smtp).sendMail({
      from: `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`,
      to: destino,
      subject: `${config.smtp.fromName} — teste do e-mail de cobrança`,
      html: '<p>Este é um teste do e-mail de cobrança. Se você recebeu, o envio de boletos está funcionando.</p>',
    }), 30_000);
    return { ok: true, message: 'E-mail de teste enviado.' };
  } catch (err) {
    logger.warn({ err }, 'Falha no teste do SMTP de cobrança');
    return { ok: false, message: err instanceof ValidationError ? err.message : 'Não foi possível enviar com essas configurações.' };
  }
}

// ---------- cobranças (boletos) ----------

function auditCobranca(event: string, usuario: AuthenticatedUser, ctx: RequestContext, changes: unknown) {
  return recordAudit({ userId: usuario.id, userName: usuario.name, event, entityType: 'BILLING', entityId: event, changes, ...ctx });
}

async function gravarCobrancas(atual: BillingSettings, cobrancas: Cobranca[]): Promise<void> {
  await writeCategory('billing', { ...atual, cobrancas });
  invalidarCacheBilling();
}

export interface NovaCobrancaInput {
  referencia: string;
  vencimento: string;
  valor: number;
  observacao: string;
}

export async function criarCobranca(
  input: NovaCobrancaInput,
  arquivo: { buffer: Buffer; originalname: string },
  usuario: AuthenticatedUser,
  ctx: RequestContext,
): Promise<Cobranca> {
  if (arquivo.buffer.length > PDF_MAX_BYTES) throw new ValidationError('O PDF do boleto pode ter no máximo 5 MB.');
  if (!ehPdf(arquivo.buffer)) throw new ValidationError('Anexe o boleto em PDF (o arquivo enviado não é um PDF válido).');

  const atual = await getBilling();
  const cobranca: Cobranca = {
    id: randomUUID(),
    ...input,
    arquivoNome: nomeSeguro(arquivo.originalname),
    arquivoTamanho: arquivo.buffer.length,
    criadoEm: new Date().toISOString(),
    criadoPor: usuario.name,
    enviadoEm: null,
    enviadoPara: [],
    envios: 0,
    pagoEm: null,
  };
  await mkdir(pastaCobrancas(), { recursive: true });
  await writeFile(caminhoDoArquivo(cobranca.id), arquivo.buffer);
  try {
    await gravarCobrancas(atual, [cobranca, ...atual.cobrancas]);
  } catch (err) {
    await rm(caminhoDoArquivo(cobranca.id), { force: true });
    throw err;
  }
  await auditCobranca('BILLING_COBRANCA_CREATED', usuario, ctx, { cobranca });
  return cobranca;
}

function acharCobranca(atual: BillingSettings, id: string): Cobranca {
  const cobranca = atual.cobrancas.find((item) => item.id === id);
  if (!cobranca) throw new NotFoundError('Cobrança não encontrada.', 'COBRANCA_NOT_FOUND');
  return cobranca;
}

export async function arquivoDaCobranca(id: string): Promise<{ nome: string; buffer: Buffer }> {
  const cobranca = acharCobranca(await getBilling(), id);
  try {
    return { nome: cobranca.arquivoNome, buffer: await readFile(caminhoDoArquivo(id)) };
  } catch {
    throw new NotFoundError('O arquivo desta cobrança não foi encontrado no servidor.', 'COBRANCA_FILE_MISSING');
  }
}

export async function removerCobranca(id: string, usuario: AuthenticatedUser, ctx: RequestContext): Promise<void> {
  const atual = await getBilling();
  const cobranca = acharCobranca(atual, id);
  await gravarCobrancas(atual, atual.cobrancas.filter((item) => item.id !== id));
  await rm(caminhoDoArquivo(id), { force: true });
  await auditCobranca('BILLING_COBRANCA_REMOVED', usuario, ctx, { cobranca });
}

/** Teto de tempo para o envio: SMTP errado/travado não deixa a tela esperando indefinidamente. */
function comTimeout<T>(promessa: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const limite = new Promise<never>((_, rejeitar) => {
    timer = setTimeout(() => rejeitar(new Error('Tempo esgotado ao enviar o e-mail.')), ms);
  });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(timer));
}

const escapar = (texto: string) => texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const moeda = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = (iso: string) => iso.split('-').reverse().join('/');

export function montarEmailBoleto(cobranca: Pick<Cobranca, 'referencia' | 'vencimento' | 'valor'>, remetente: string, mensagem: string): { assunto: string; html: string } {
  const [ano, mes] = cobranca.referencia.split('-');
  const referencia = `${mes}/${ano}`;
  const extra = mensagem.trim() ? `<p>${escapar(mensagem.trim()).replace(/\n/g, '<br>')}</p>` : '';
  return {
    assunto: `${remetente} — boleto de ${referencia} (vencimento ${dataBr(cobranca.vencimento)})`,
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1f2937">
<p>Olá,</p>
<p>Segue em anexo o boleto referente a <strong>${referencia}</strong>.</p>
<table style="border-collapse:collapse;margin:12px 0"><tr><td style="padding:4px 12px 4px 0;color:#6b7280">Valor</td><td><strong>${moeda(cobranca.valor)}</strong></td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#6b7280">Vencimento</td><td><strong>${dataBr(cobranca.vencimento)}</strong></td></tr></table>
${extra}<p>Em caso de dúvida, é só responder este e-mail.</p><p>${escapar(remetente)}</p></div>`,
  };
}

export interface EnviarCobrancaInput {
  para?: string[];
  mensagem?: string;
}

export async function enviarCobranca(id: string, input: EnviarCobrancaInput, usuario: AuthenticatedUser, ctx: RequestContext): Promise<Cobranca> {
  const atual = await getBilling();
  const cobranca = acharCobranca(atual, id);
  const config = await getCobrancaSettings();
  assertSmtp(config);
  const destinatarios = input.para?.length ? input.para : config.emails;
  if (destinatarios.length === 0) throw new ValidationError('Cadastre ao menos um e-mail de cobrança do cliente antes de enviar.');
  const { buffer, nome } = await arquivoDaCobranca(id);
  const { assunto, html } = montarEmailBoleto(cobranca, config.smtp.fromName, input.mensagem ?? '');

  try {
    await comTimeout(buildTransport(config.smtp).sendMail({
      from: `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`,
      to: destinatarios,
      bcc: config.copiaOculta || undefined,
      subject: assunto,
      html,
      attachments: [{ filename: nome, content: buffer, contentType: 'application/pdf' }],
    }), 45_000);
  } catch (err) {
    logger.warn({ err }, 'Falha ao enviar boleto por e-mail');
    throw new AppError('COBRANCA_EMAIL_FAILED', 'Não foi possível enviar o e-mail. Confira o SMTP de cobrança e tente de novo.', 502);
  }

  const atualizada: Cobranca = { ...cobranca, enviadoEm: new Date().toISOString(), enviadoPara: destinatarios, envios: cobranca.envios + 1 };
  await gravarCobrancas(atual, atual.cobrancas.map((item) => (item.id === id ? atualizada : item)));
  await auditCobranca('BILLING_COBRANCA_SENT', usuario, ctx, { cobrancaId: id, referencia: cobranca.referencia, para: destinatarios, bcc: Boolean(config.copiaOculta) });
  return atualizada;
}
