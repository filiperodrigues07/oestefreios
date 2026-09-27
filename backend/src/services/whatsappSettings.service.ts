import { z } from 'zod';
import type { AuthenticatedUser } from '../types/auth.types.js';
import type { RequestContext } from '../utils/requestContext.js';
import { recordAudit } from './auditLog.service.js';
import { decryptSecret, encryptSecret, readCategory, SENHA_MASCARADA, writeCategory } from './settings.service.js';

export const MESSAGE_TYPES = ['aberta', 'aguardando_cliente', 'aguardando_peca', 'pronta', 'resumo_financeiro'] as const;
export type MessageType = typeof MESSAGE_TYPES[number];
export type Channel = 'whatsapp' | 'email';

export interface WhatsappSettings {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
  templates: Record<MessageType, string>;
  automatic: Record<Exclude<MessageType, 'resumo_financeiro'>, boolean>;
  automaticEmail: Record<Exclude<MessageType, 'resumo_financeiro'>, boolean>;
}

const PREVIOUS_DEFAULT_TEMPLATES: WhatsappSettings['templates'] = {
  aberta: 'Olá, {cliente}! Sua OS #{os} para {veiculo} foi aberta. Avisaremos sobre o andamento.',
  aguardando_cliente: 'Olá, {cliente}! A OS #{os} de {veiculo} aguarda seu retorno. Responda esta mensagem para continuarmos.',
  aguardando_peca: 'Olá, {cliente}! A OS #{os} de {veiculo} está aguardando peças. Avisaremos quando houver novidades.',
  pronta: 'Olá, {cliente}! Sua OS #{os} de {veiculo} está pronta. Entre em contato para combinar a retirada.',
  resumo_financeiro: 'Resumo da OS #{os} de {veiculo}: produtos {produtos}, serviços {servicos}, total {total}.',
};

const PLAIN_DEFAULT_TEMPLATES: WhatsappSettings['templates'] = {
  aberta: 'Olá, {cliente}! Registramos a OS #{os} do veículo {veiculo}. Avisaremos sobre o andamento. Equipe Oeste Freios.',
  aguardando_cliente: 'Olá, {cliente}! Precisamos do seu retorno para continuar a OS #{os} ({veiculo}). Responda por aqui quando puder. Equipe Oeste Freios.',
  aguardando_peca: 'Olá, {cliente}! A OS #{os} ({veiculo}) está aguardando peças. Avisaremos assim que houver novidades. Equipe Oeste Freios.',
  pronta: 'Olá, {cliente}! A OS #{os} ({veiculo}) está pronta. Entre em contato para combinar a retirada. Equipe Oeste Freios.',
  resumo_financeiro: 'Olá, {cliente}! Segue o resumo da OS #{os} ({veiculo}):\n\n{itens}\n\nProdutos: {produtos}\nServiços: {servicos}\nTotal: {total}\n\nSe tiver alguma dúvida, responda esta mensagem. Equipe Oeste Freios.',
};

export const DEFAULT_WHATSAPP_SETTINGS: WhatsappSettings = {
  baseUrl: '',
  apiKey: '',
  instanceName: 'oeste-freios',
  templates: {
    aberta: '🛠️ Olá, {cliente}! Registramos a *OS #{os}* do veículo {veiculo}. Avisaremos sobre o andamento. Equipe Oeste Freios.',
    aguardando_cliente: '⏳ Olá, {cliente}! Precisamos do seu retorno para continuar a *OS #{os}* ({veiculo}). Responda por aqui quando puder. Equipe Oeste Freios.',
    aguardando_peca: '📦 Olá, {cliente}! A *OS #{os}* ({veiculo}) está aguardando peças. Avisaremos assim que houver novidades. Equipe Oeste Freios.',
    pronta: '✅ Olá, {cliente}! A *OS #{os}* ({veiculo}) está pronta. Entre em contato para combinar a retirada. Equipe Oeste Freios.',
    resumo_financeiro: '🧾 Olá, {cliente}! Segue o resumo da *OS #{os}* ({veiculo}):\n\n{itens}\n\nProdutos: *{produtos}*\nServiços: *{servicos}*\n💰 *Total: {total}*\n\nSe tiver alguma dúvida, responda esta mensagem. Equipe Oeste Freios.',
  },
  automatic: { aberta: false, aguardando_cliente: false, aguardando_peca: false, pronta: false },
  automaticEmail: { aberta: false, aguardando_cliente: false, aguardando_peca: false, pronta: false },
};

const templateSchema = z.string().trim().min(1).max(1200).refine(
  (text) => [...text.matchAll(/\{([^{}]+)\}/g)].every((match) =>
    ['cliente', 'os', 'veiculo', 'status', 'itens', 'produtos', 'servicos', 'total'].includes(match[1]!)
  ) && !/[{}]/.test(text.replace(/\{(?:cliente|os|veiculo|status|itens|produtos|servicos|total)\}/g, '')),
  'Use apenas as variáveis mostradas na tela.',
);

export const whatsappSettingsSchema = z.object({
  baseUrl: z.union([z.literal(''), z.url().refine((value) => {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/';
  }, 'Informe apenas o endereço HTTP ou HTTPS da Evolution, sem caminho ou credenciais.')]),
  apiKey: z.string().max(500),
  instanceName: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,60}$/, 'Use apenas letras, números, _ ou -.'),
  templates: z.object(Object.fromEntries(MESSAGE_TYPES.map((type) => [type, templateSchema])) as Record<MessageType, typeof templateSchema>),
  automatic: z.object({ aberta: z.boolean(), aguardando_cliente: z.boolean(), aguardando_peca: z.boolean(), pronta: z.boolean() }),
  automaticEmail: z.object({ aberta: z.boolean(), aguardando_cliente: z.boolean(), aguardando_peca: z.boolean(), pronta: z.boolean() }),
}).superRefine((data, ctx) => {
  for (const type of MESSAGE_TYPES) {
    if (type !== 'resumo_financeiro' && /\{(?:itens|produtos|servicos|total)\}/.test(data.templates[type])) {
      ctx.addIssue({ code: 'custom', path: ['templates', type], message: 'Valores só podem aparecer no modelo de resumo financeiro.' });
    }
  }
});

export async function getWhatsappSettings(): Promise<WhatsappSettings> {
  const data = await readCategory('whatsapp', DEFAULT_WHATSAPP_SETTINGS);
  const templates = { ...DEFAULT_WHATSAPP_SETTINGS.templates, ...data.templates };
  for (const type of MESSAGE_TYPES) {
    if (templates[type] === PREVIOUS_DEFAULT_TEMPLATES[type] || templates[type] === PLAIN_DEFAULT_TEMPLATES[type]) {
      templates[type] = DEFAULT_WHATSAPP_SETTINGS.templates[type];
    }
  }
  const oldSummary = 'Olá, {cliente}! Segue o resumo da OS #{os} ({veiculo}):\n\n{itens}\n\nProdutos: {produtos}\nServiços: {servicos}\nTotal: {total}';
  if (templates.resumo_financeiro.startsWith(oldSummary)) {
    templates.resumo_financeiro = templates.resumo_financeiro.replace(oldSummary,
      '🧾 Olá, {cliente}! Segue o resumo da *OS #{os}* ({veiculo}):\n\n{itens}\n\nProdutos: *{produtos}*\nServiços: *{servicos}*\n💰 *Total: {total}*');
  }
  return {
    ...data,
    templates,
    automatic: { ...DEFAULT_WHATSAPP_SETTINGS.automatic, ...data.automatic },
    automaticEmail: { ...DEFAULT_WHATSAPP_SETTINGS.automaticEmail, ...data.automaticEmail },
    apiKey: decryptSecret(data.apiKey),
  };
}

export async function getWhatsappSettingsMasked(): Promise<WhatsappSettings> {
  const data = await getWhatsappSettings();
  return { ...data, apiKey: data.apiKey ? SENHA_MASCARADA : '' };
}

export async function saveWhatsappSettings(input: WhatsappSettings, user: AuthenticatedUser, ctx: RequestContext): Promise<void> {
  const old = await getWhatsappSettings();
  const apiKey = !input.apiKey || input.apiKey === SENHA_MASCARADA ? old.apiKey : input.apiKey;
  await writeCategory('whatsapp', { ...input, baseUrl: input.baseUrl.replace(/\/+$/, ''), apiKey: encryptSecret(apiKey) });
  await recordAudit({ userId: user.id, userName: user.name, event: 'SETTINGS_WHATSAPP_UPDATED', entityType: 'SETTINGS', entityId: 'whatsapp', changes: {
    baseUrl: input.baseUrl, instanceName: input.instanceName, apiKeyChanged: apiKey !== old.apiKey,
    automatic: input.automatic, automaticEmail: input.automaticEmail,
    templatesChanged: MESSAGE_TYPES.filter((type) => input.templates[type] !== old.templates[type]),
  }, ...ctx });
}
