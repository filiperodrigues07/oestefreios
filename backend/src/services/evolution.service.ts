import { AppError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';
import { getWhatsappSettings, type WhatsappSettings } from './whatsappSettings.service.js';

function assertConfigured(settings: WhatsappSettings): void {
  if (!settings.baseUrl || !settings.apiKey || !settings.instanceName) {
    throw new AppError('WHATSAPP_NOT_CONFIGURED', 'Configure a conexão do WhatsApp antes de enviar mensagens.', 400);
  }
}

async function requestEvolution<T>(settings: WhatsappSettings, path: string, method: 'GET' | 'POST' = 'GET', body?: unknown, timeoutMs = 12_000): Promise<T> {
  assertConfigured(settings);
  let response: Response;
  try {
    response = await fetch(`${settings.baseUrl}${path}`, {
      method,
      headers: { apikey: settings.apiKey, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    logger.warn({ err: error }, 'Evolution API indisponível');
    throw new AppError('WHATSAPP_UNAVAILABLE', 'WhatsApp indisponível. Verifique a conexão e tente novamente.', 502);
  }
  if (!response.ok) {
    logger.warn({ status: response.status, path }, 'Evolution API recusou a requisição');
    if (response.status === 401 || response.status === 403) throw new AppError('WHATSAPP_AUTH_FAILED', 'Chave do WhatsApp inválida. Confira as configurações.', 502);
    if (response.status === 404) throw new AppError('WHATSAPP_INSTANCE_MISSING', 'Instância do WhatsApp não encontrada. Confira o nome configurado.', 502);
    if (path.startsWith('/message/sendMedia/') && [400, 413, 415, 422].includes(response.status)) {
      throw new AppError('WHATSAPP_PDF_REJECTED', 'O WhatsApp recusou o PDF da OS. Confira o documento ou tente enviar sem anexo.', 502);
    }
    throw new AppError('WHATSAPP_UNAVAILABLE', 'Não foi possível falar com o WhatsApp. Tente novamente.', 502);
  }
  return response.json() as Promise<T>;
}

export async function getEvolutionConnection(): Promise<{ state: string }> {
  const settings = await getWhatsappSettings();
  const result = await requestEvolution<{ instance?: { state?: string } }>(settings, `/instance/connectionState/${encodeURIComponent(settings.instanceName)}`);
  return { state: result.instance?.state ?? 'close' };
}

export async function getEvolutionQr(): Promise<{ base64: string | null; pairingCode: string | null }> {
  const settings = await getWhatsappSettings();
  const result = await requestEvolution<{ base64?: string; pairingCode?: string; qrcode?: { base64?: string } }>(settings, `/instance/connect/${encodeURIComponent(settings.instanceName)}`);
  const base64 = result.base64 ?? result.qrcode?.base64 ?? null;
  return { base64: base64?.startsWith('data:image/png;base64,') ? base64 : base64 ? `data:image/png;base64,${base64}` : null, pairingCode: result.pairingCode ?? null };
}

export async function createEvolutionInstance(): Promise<void> {
  const settings = await getWhatsappSettings();
  await requestEvolution(settings, '/instance/create', 'POST', {
    instanceName: settings.instanceName, integration: 'WHATSAPP-BAILEYS', qrcode: true,
  });
}

export async function sendEvolutionText(number: string, text: string): Promise<string | null> {
  const settings = await getWhatsappSettings();
  const result = await requestEvolution<{ key?: { id?: string } }>(settings, `/message/sendText/${encodeURIComponent(settings.instanceName)}`, 'POST', { number, text });
  return result.key?.id ?? null;
}

export async function sendEvolutionPdf(number: string, caption: string, pdf: Buffer, fileName: string): Promise<string | null> {
  const settings = await getWhatsappSettings();
  const result = await requestEvolution<{ key?: { id?: string } }>(settings,
    `/message/sendMedia/${encodeURIComponent(settings.instanceName)}`, 'POST', {
      number, mediatype: 'document', mimetype: 'application/pdf', caption,
      media: pdf.toString('base64'), fileName,
    }, 20_000);
  return result.key?.id ?? null;
}
