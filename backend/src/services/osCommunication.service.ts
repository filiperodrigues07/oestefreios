import { randomUUID } from 'node:crypto';
import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { db, pool } from '../database/postgres/client.js';
import { clientNotificationPreferences, osMessageDeliveries } from '../database/postgres/schema.js';
import { toOSDTO } from '../dto/mappers/os.mapper.js';
import { AppError } from '../errors/AppError.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import { ValidationError } from '../errors/ValidationError.js';
import { clienteRepository, osRepository } from '../repositories/index.js';
import type { AuthenticatedUser, Permission } from '../types/auth.types.js';
import type { OrdemServico } from '../types/cherp.types.js';
import { escaparHtml } from '../utils/html.js';
import { logger } from '../utils/logger.js';
import { resolverLogoParaPdf } from '../utils/brandingAssets.js';
import { exportarOSPdf } from './reportExport.service.js';
import { buildTransport, getGeralSettings, getSmtpSettings } from './settings.service.js';
import { sendEvolutionPdf, sendEvolutionText } from './evolution.service.js';
import { recordAudit } from './auditLog.service.js';
import type { RequestContext } from '../utils/requestContext.js';
import { getWhatsappSettings, MESSAGE_TYPES, type Channel, type MessageType } from './whatsappSettings.service.js';

const STATUS_MESSAGE: Partial<Record<string, Exclude<MessageType, 'resumo_financeiro'>>> = {
  ABERTA: 'aberta', AGUARDANDO_CLIENTE: 'aguardando_cliente', AGUARDANDO_PECA: 'aguardando_peca', CONCLUIDA: 'pronta',
};
const MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function normalizeWhatsappNumber(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (/^\d{10,11}$/.test(digits)) return `55${digits}`;
  if (/^55\d{10,11}$/.test(digits)) return digits;
  return null;
}

function knownMoney(value: number | undefined): string {
  return value !== undefined && Number.isFinite(value) ? MOEDA.format(value) : 'a confirmar';
}

function sumItems(items: { total?: number }[]): number | undefined {
  return items.every((item) => item.total !== undefined && Number.isFinite(item.total))
    ? items.reduce((sum, item) => sum + item.total!, 0)
    : undefined;
}

function itemLines(items: OrdemServico['produtos'] | OrdemServico['servicos'], unitPrice: 'precoUnitario' | 'valorUnitario'): string[] {
  return items.map((item) => {
    const price = unitPrice === 'precoUnitario' ? 'precoUnitario' in item ? item.precoUnitario : undefined
      : 'valorUnitario' in item ? item.valorUnitario : undefined;
    const quantity = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(item.quantidade);
    return `• ${quantity} ${item.unidade} — ${item.descricao}${price !== undefined ? ` (${knownMoney(price)}/un.)` : ''}: *${knownMoney(item.total)}*`;
  });
}

export function renderOsMessage(template: string, os: OrdemServico, clientName: string, type: MessageType): string {
  const produtos = sumItems(os.produtos);
  const servicos = sumItems(os.servicos);
  const productLines = itemLines(os.produtos, 'precoUnitario');
  const serviceLines = itemLines(os.servicos, 'valorUnitario');
  const itens = [
    '📦 *Produtos*', ...(productLines.length ? productLines : ['Nenhum']),
    '', '🔧 *Serviços realizados*', ...(serviceLines.length ? serviceLines : ['Nenhum']),
  ].join('\n');
  const values: Record<string, string> = {
    cliente: clientName, os: String(os.numero), veiculo: os.equipamentoDescricao ?? 'veículo',
    status: os.status.replaceAll('_', ' ').toLowerCase(),
    itens: type === 'resumo_financeiro' ? itens : '',
    produtos: type === 'resumo_financeiro' ? knownMoney(produtos) : '',
    servicos: type === 'resumo_financeiro' ? knownMoney(servicos) : '',
    total: type === 'resumo_financeiro' ? knownMoney(os.faturamento ?? (produtos !== undefined && servicos !== undefined ? produtos + servicos : undefined)) : '',
  };
  return template.replace(/\{(cliente|os|veiculo|status|itens|produtos|servicos|total)\}/g, (_, key: string) => values[key] ?? '');
}

export function formatOsEmailBody(body: string): { text: string; html: string } {
  const bold = /\*([^*\n]+)\*/g;
  return {
    text: body.replace(bold, '$1'),
    html: `<p>${escaparHtml(body).replace(bold, '<strong>$1</strong>').replace(/\n/g, '<br>')}</p>`,
  };
}

async function loadContext(id: string) {
  const os = await osRepository.buscarPorId(id);
  if (!os) throw new NotFoundError('Ordem de serviço não encontrada.', 'OS_NOT_FOUND');
  const client = await clienteRepository.buscarPorCodigo(os.clienteCodigo);
  if (!client) throw new ValidationError('Cliente da OS não encontrado. Confira o cadastro antes de enviar.');
  return { os, client };
}

function recipient(channel: Channel, client: { celular?: string; telefone?: string; emailNfe?: string; emailFinanceiro?: string }): string | null {
  if (channel === 'whatsapp') return normalizeWhatsappNumber(client.celular ?? '');
  return client.emailNfe?.trim() || client.emailFinanceiro?.trim() || null;
}

export async function getOsMessagePreview(id: string, permissions: Permission[]) {
  const { os, client } = await loadContext(id);
  const settings = await getWhatsappSettings();
  const whatsapp = recipient('whatsapp', client);
  const [preference] = await db.select().from(clientNotificationPreferences).where(eq(clientNotificationPreferences.clientCode, os.clienteCodigo));
  const messages = Object.fromEntries(MESSAGE_TYPES.filter((type) => type !== 'resumo_financeiro' || permissions.includes('FINANCIAL_VIEW'))
    .map((type) => [type, renderOsMessage(settings.templates[type], os, client.nome, type)]));
  return {
    clientName: client.nome,
    whatsapp,
    whatsappIssue: whatsapp ? null : client.celular?.trim() ? 'invalid' : 'missing',
    email: recipient('email', client),
    whatsappConsent: preference?.whatsappConsent ?? false,
    messages,
  };
}

export async function setWhatsappConsent(clientCode: string, allowed: boolean): Promise<void> {
  await db.insert(clientNotificationPreferences).values({ clientCode, whatsappConsent: allowed })
    .onConflictDoUpdate({ target: clientNotificationPreferences.clientCode, set: { whatsappConsent: allowed, updatedAt: new Date() } });
}

export async function revokeOsWhatsappConsent(id: string, user: AuthenticatedUser, ctx: RequestContext): Promise<void> {
  const { os } = await loadContext(id);
  await setWhatsappConsent(os.clienteCodigo, false);
  await db.update(osMessageDeliveries).set({ state: 'failed', errorCode: 'CONSENT_REVOKED', updatedAt: new Date() })
    .where(and(eq(osMessageDeliveries.clientCode, os.clienteCodigo), eq(osMessageDeliveries.channel, 'whatsapp'), eq(osMessageDeliveries.state, 'queued')));
  await recordAudit({ userId: user.id, userName: user.name, event: 'CLIENTE_WHATSAPP_CONSENT_REVOKED', entityType: 'CLIENTE', entityId: os.clienteCodigo, ...ctx });
}

async function insertDelivery(input: {
  os: OrdemServico; channel: Channel; type: MessageType; recipient: string; body: string;
  source: 'manual' | 'automatic'; containsFinancial: boolean; createdBy?: string; eventKey?: string;
}) {
  const [row] = await db.insert(osMessageDeliveries).values({
    osId: input.os.id, clientCode: input.os.clienteCodigo, channel: input.channel,
    messageType: input.type, recipient: input.recipient, body: input.body,
    source: input.source, containsFinancial: input.containsFinancial,
    createdBy: input.createdBy, eventKey: input.eventKey,
  }).onConflictDoNothing({ target: osMessageDeliveries.eventKey }).returning({ id: osMessageDeliveries.id });
  return row?.id ?? null;
}

export async function sendManualOsMessage(id: string, channel: Channel, type: MessageType, user: AuthenticatedUser, consent: boolean, ctx: RequestContext, attachPdf = false) {
  if (attachPdf && channel !== 'whatsapp') throw new ValidationError('A opção de anexo é exclusiva do WhatsApp. O e-mail já inclui o PDF da OS.');
  if (type === 'resumo_financeiro' && !user.permissions.includes('FINANCIAL_VIEW')) {
    throw new AppError('FINANCIAL_PERMISSION_REQUIRED', 'Você não tem permissão para enviar valores da OS.', 403);
  }
  const { os, client } = await loadContext(id);
  const destination = recipient(channel, client);
  if (!destination) throw new ValidationError(channel === 'whatsapp'
    ? 'Cadastre um celular válido no cliente antes de enviar pelo WhatsApp.'
    : 'Cadastre o E-mail NFe/NFSe ou o e-mail financeiro do cliente antes de enviar.');
  if (channel === 'whatsapp') {
    const [preference] = await db.select().from(clientNotificationPreferences).where(eq(clientNotificationPreferences.clientCode, os.clienteCodigo));
    if (!preference?.whatsappConsent && !consent) throw new ValidationError('Confirme a autorização do cliente para mensagens por WhatsApp.');
    if (consent && !preference?.whatsappConsent) {
      await setWhatsappConsent(os.clienteCodigo, true);
      await recordAudit({ userId: user.id, userName: user.name, event: 'CLIENTE_WHATSAPP_CONSENT_GRANTED', entityType: 'CLIENTE', entityId: os.clienteCodigo, ...ctx });
    }
  }
  const settings = await getWhatsappSettings();
  const body = renderOsMessage(settings.templates[type], os, client.nome, type);
  const recent = await db.select({ id: osMessageDeliveries.id }).from(osMessageDeliveries).where(and(
    eq(osMessageDeliveries.osId, id), eq(osMessageDeliveries.channel, channel),
    eq(osMessageDeliveries.messageType, type), eq(osMessageDeliveries.state, 'accepted'),
    gte(osMessageDeliveries.createdAt, new Date(Date.now() - 60_000)),
  )).limit(1);
  if (recent.length) throw new AppError('MESSAGE_RECENTLY_SENT', 'Esta mensagem já foi enviada há menos de um minuto. Confira o histórico antes de reenviar.', 409);
  const deliveryId = await insertDelivery({ os, channel, type, recipient: destination, body, source: 'manual', containsFinancial: type === 'resumo_financeiro', createdBy: user.id });
  if (!deliveryId) throw new AppError('MESSAGE_NOT_CREATED', 'Não foi possível preparar a mensagem. Tente novamente.', 500);
  return deliverOsMessage(deliveryId, attachPdf);
}

export async function enqueueStatusMessages(os: OrdemServico, status: string): Promise<void> {
  const type = STATUS_MESSAGE[status];
  if (!type) return;
  const settings = await getWhatsappSettings();
  if (!settings.automatic[type] && !settings.automaticEmail[type]) return;
  const client = await clienteRepository.buscarPorCodigo(os.clienteCodigo);
  if (!client) return;
  const body = renderOsMessage(settings.templates[type], os, client.nome, type);
  const event = randomUUID();
  if (settings.automatic[type]) {
    const [preference] = await db.select().from(clientNotificationPreferences).where(eq(clientNotificationPreferences.clientCode, os.clienteCodigo));
    const phone = recipient('whatsapp', client);
    if (preference?.whatsappConsent && phone) await insertDelivery({ os, channel: 'whatsapp', type, recipient: phone, body, source: 'automatic', containsFinancial: false, eventKey: `${event}:whatsapp` });
  }
  if (settings.automaticEmail[type]) {
    const email = recipient('email', client);
    if (email) await insertDelivery({ os, channel: 'email', type, recipient: email, body, source: 'automatic', containsFinancial: false, eventKey: `${event}:email` });
  }
}

async function buildOsPdf(id: string, containsFinancial: boolean): Promise<{ pdf: Buffer; numero: number; nomeEmpresa: string }> {
  const os = await osRepository.buscarPorId(id);
  if (!os) throw new NotFoundError('Ordem de serviço não encontrada.', 'OS_NOT_FOUND');
  const geral = await getGeralSettings();
  const branding = { nomeEmpresa: geral.nomeEmpresa, logoUrl: await resolverLogoParaPdf(geral.logoUrl), corDestaque: geral.corDestaque };
  try {
    return { pdf: await exportarOSPdf(toOSDTO(os, containsFinancial ? ['FINANCIAL_VIEW'] : []), branding), numero: os.numero, nomeEmpresa: geral.nomeEmpresa };
  } catch (error) {
    logger.warn({ err: error, osId: id }, 'Falha ao gerar PDF da OS para mensagem');
    throw new AppError('OS_PDF_FAILED', 'Não foi possível gerar o PDF da OS. Tente novamente.', 502);
  }
}

export async function deliverOsMessage(id: string, attachPdf = false): Promise<{ id: string; state: string }> {
  const claimed = await pool.query<{
    id: string; os_id: string; client_code: string; channel: Channel; message_type: MessageType; recipient: string; body: string; contains_financial: boolean;
  }>(`UPDATE os_message_deliveries SET state = 'sending', updated_at = now()
      WHERE id = $1 AND state = 'queued'
      RETURNING id, os_id, client_code, channel, message_type, recipient, body, contains_financial`, [id]);
  const row = claimed.rows[0];
  if (!row) throw new AppError('MESSAGE_ALREADY_PROCESSED', 'Esta mensagem já foi processada. Confira o histórico da OS.', 409);
  try {
    let providerId: string | null = null;
    if (row.channel === 'whatsapp') {
      const [preference] = await db.select().from(clientNotificationPreferences)
        .where(eq(clientNotificationPreferences.clientCode, row.client_code));
      if (!preference?.whatsappConsent) throw new AppError('CONSENT_REVOKED', 'O cliente não autorizou mensagens pelo WhatsApp. Confirme uma nova autorização antes de enviar.', 409);
      if (attachPdf) {
        const { pdf, numero } = await buildOsPdf(row.os_id, row.contains_financial);
        providerId = await sendEvolutionPdf(row.recipient, row.body, pdf, `os-${numero}.pdf`);
      } else {
        providerId = await sendEvolutionText(row.recipient, row.body);
      }
    } else {
      const smtp = await getSmtpSettings();
      if (!smtp.host || !smtp.fromEmail) throw new AppError('SMTP_NOT_CONFIGURED', 'Configure o e-mail em Configurações antes de enviar.', 400);
      const { pdf, numero, nomeEmpresa } = await buildOsPdf(row.os_id, row.contains_financial);
      const emailBody = formatOsEmailBody(row.body);
      await buildTransport(smtp).sendMail({
        from: `"${smtp.fromName}" <${smtp.fromEmail}>`, to: row.recipient,
        subject: `OS #${numero} — ${nomeEmpresa}`,
        text: emailBody.text,
        html: emailBody.html,
        attachments: [{ filename: `os-${numero}.pdf`, content: pdf, contentType: 'application/pdf' }],
      });
    }
    await db.update(osMessageDeliveries).set({ state: 'accepted', providerMessageId: providerId, updatedAt: new Date() }).where(eq(osMessageDeliveries.id, id));
    return { id, state: 'accepted' };
  } catch (error) {
    logger.warn({ err: error, deliveryId: id }, 'Falha ao enviar mensagem da OS');
    const code = error instanceof AppError ? error.code : row.channel === 'email' ? 'EMAIL_SEND_FAILED' : 'WHATSAPP_SEND_FAILED';
    await db.update(osMessageDeliveries).set({ state: 'failed', errorCode: code, updatedAt: new Date() }).where(eq(osMessageDeliveries.id, id));
    if (error instanceof AppError) throw error;
    throw new AppError(code, row.channel === 'email'
      ? 'Não foi possível enviar o e-mail. Confira as configurações e tente novamente.'
      : 'Não foi possível enviar a mensagem pelo WhatsApp. Confira a conexão e tente novamente.', 502);
  }
}

export async function processQueuedOsMessages(): Promise<void> {
  // Um restart pode interromper o processo depois de o provedor aceitar o envio.
  // Marque como incerto sem reenviar automaticamente, para não duplicar a mensagem.
  await db.update(osMessageDeliveries)
    .set({ state: 'failed', errorCode: 'DELIVERY_UNCONFIRMED', updatedAt: new Date() })
    .where(and(eq(osMessageDeliveries.state, 'sending'), lt(osMessageDeliveries.updatedAt, new Date(Date.now() - 10 * 60_000))));
  const rows = await db.select({ id: osMessageDeliveries.id }).from(osMessageDeliveries)
    .where(and(eq(osMessageDeliveries.state, 'queued'), eq(osMessageDeliveries.source, 'automatic')))
    .orderBy(osMessageDeliveries.createdAt).limit(10);
  for (const row of rows) {
    try { await deliverOsMessage(row.id); }
    catch (error) { if (!(error instanceof AppError && error.code === 'MESSAGE_ALREADY_PROCESSED')) logger.warn({ err: error }, 'Envio automático da OS falhou'); }
  }
}

export async function listOsMessageHistory(id: string, permissions: Permission[]) {
  const rows = await db.select().from(osMessageDeliveries).where(eq(osMessageDeliveries.osId, id))
    .orderBy(desc(osMessageDeliveries.createdAt)).limit(30);
  return rows.map((row) => ({
    id: row.id, channel: row.channel, messageType: row.messageType, recipient: row.recipient,
    body: row.containsFinancial && !permissions.includes('FINANCIAL_VIEW') ? null : row.body,
    state: row.state, source: row.source, errorCode: row.errorCode, createdAt: row.createdAt,
  }));
}
