import * as Firebird from 'node-firebird';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import nodemailer from 'nodemailer';
import { eq } from 'drizzle-orm';
import { env } from '../config/env.js';
import { firebirdOptions } from '../config/firebird.config.js';
import { reloadFirebirdPool } from '../database/firebird/pool.js';
import { db } from '../database/postgres/client.js';
import { settings } from '../database/postgres/schema.js';
import { getCherpMode, setCherpMode, type CherpMode as CherpModeType } from '../repositories/cherpMode.js';
import { logger } from '../utils/logger.js';
import type { AuthenticatedUser } from '../types/auth.types.js';
import type { RequestContext } from '../utils/requestContext.js';
import { recordAudit } from './auditLog.service.js';

function auditSettings(event: string, usuario: AuthenticatedUser, ctx: RequestContext, changes: unknown) {
  return recordAudit({ userId: usuario.id, userName: usuario.name, event, entityType: 'SETTINGS', entityId: event, changes, ...ctx });
}

const SENHA_MASCARADA = '••••••••';
const ENCRYPTED_PREFIX = 'enc:v1:';

function settingsKey(): Buffer {
  return createHash('sha256').update(env.SETTINGS_ENCRYPTION_KEY ?? env.JWT_REFRESH_SECRET).digest();
}

function encryptSecret(value: string): string {
  if (!value || value.startsWith(ENCRYPTED_PREFIX)) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', settingsKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${ENCRYPTED_PREFIX}${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptSecret(value: string): string {
  if (!value.startsWith(ENCRYPTED_PREFIX)) return value;
  const [ivRaw, tagRaw, encryptedRaw] = value.slice(ENCRYPTED_PREFIX.length).split(':');
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error('Credencial criptografada inválida.');
  const decipher = createDecipheriv('aes-256-gcm', settingsKey(), Buffer.from(ivRaw, 'base64'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, 'base64')), decipher.final()]).toString('utf8');
}

export interface FirebirdSettings {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  charset: string;
}

export type SmtpSeguranca = 'nenhuma' | 'starttls' | 'ssl';

export interface SmtpSettings {
  host: string;
  port: number;
  seguranca: SmtpSeguranca;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

export interface GeralSettings {
  nomeEmpresa: string;
  logoUrl: string;
  corDestaque: string;
  fusoHorario: string;
}

/** Credenciais de integrações externas, sempre criptografadas antes da persistência. */
export interface IntegracoesSettings {
  sintegraApiKey: string;
  dadosApiToken: string;
}

const FIREBIRD_PADRAO: FirebirdSettings = {
  host: env.FIREBIRD_HOST,
  port: env.FIREBIRD_PORT,
  database: env.FIREBIRD_DATABASE,
  user: env.FIREBIRD_USER,
  password: env.FIREBIRD_PASSWORD,
  charset: 'NONE',
};

const SMTP_PADRAO: SmtpSettings = {
  host: '',
  port: 587,
  seguranca: 'starttls',
  user: '',
  password: '',
  fromEmail: '',
  fromName: 'Oeste Freios',
};

const GERAL_PADRAO: GeralSettings = {
  nomeEmpresa: 'Oeste Freios',
  logoUrl: '',
  corDestaque: '',
  fusoHorario: 'America/Sao_Paulo',
};

const INTEGRACOES_PADRAO: IntegracoesSettings = {
  sintegraApiKey: '',
  dadosApiToken: env.DADOS_API_TOKEN ?? '',
};

async function readCategory<T>(category: string, fallback: T): Promise<T> {
  const [row] = await db.select().from(settings).where(eq(settings.category, category));
  if (!row) return fallback;
  return { ...fallback, ...(row.data as Partial<T>) };
}

async function writeCategory<T extends object>(category: string, data: T): Promise<void> {
  await db
    .insert(settings)
    .values({ category, data, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.category, set: { data, updatedAt: new Date() } });
}

export async function getFirebirdSettings(): Promise<FirebirdSettings> {
  const data = await readCategory('firebird', FIREBIRD_PADRAO);
  return { ...data, password: decryptSecret(data.password) };
}

/** Versão segura pra devolver ao frontend — senha nunca volta em texto puro. */
export async function getFirebirdSettingsMasked(): Promise<FirebirdSettings> {
  const data = await getFirebirdSettings();
  return { ...data, password: data.password ? SENHA_MASCARADA : '' };
}

/** Revelação explícita, restrita pela rota a SYSTEM_SETTINGS; nunca usada na carga normal da tela. */
export async function getFirebirdPassword(): Promise<string> {
  return (await getFirebirdSettings()).password;
}

/** Verifica a configuração efetivamente carregada sem exigir que o usuário clique em testar. */
export async function getFirebirdConnectionStatus(): Promise<{ ok: boolean; message: string; checkedAt: string }> {
  const result = await testFirebirdConnection(await getFirebirdSettings());
  return { ...result, checkedAt: new Date().toISOString() };
}

/**
 * Salva as configs do Firebird e já troca o pool de conexões em uso (sem reiniciar o
 * processo — ver `reloadFirebirdPool`). Se `password` vier vazia ou igual à máscara
 * exibida na tela, mantém a senha já salva (o formulário não reenvia senha em texto puro).
 */
function toFirebirdAttachOptions(s: FirebirdSettings): Firebird.Options {
  return {
    host: s.host,
    port: s.port,
    database: s.database,
    user: s.user,
    password: s.password,
    encoding: s.charset as Firebird.SupportedCharacterSet,
  };
}

export async function saveFirebirdSettings(input: FirebirdSettings, usuario?: AuthenticatedUser, ctx: RequestContext = {}): Promise<{ cherpMode: CherpModeType }> {
  const atual = await getFirebirdSettings();
  const password = !input.password || input.password === SENHA_MASCARADA ? atual.password : input.password;
  const final: FirebirdSettings = { ...input, password };
  await writeCategory('firebird', { ...final, password: encryptSecret(final.password) });
  if (usuario) await auditSettings('SETTINGS_FIREBIRD_UPDATED', usuario, ctx, {
    before: { ...atual, password: undefined }, after: { ...final, password: undefined }, passwordChanged: password !== atual.password,
  });
  await reloadFirebirdPool(toFirebirdAttachOptions(final));

  // Credencial salva e conecta de verdade → liga o modo Firebird sozinho, sem precisar
  // reiniciar o processo. Se não conectar, mantém o modo atual (não desliga um Firebird que
  // já estava funcionando só porque uma tentativa de salvar deu errado).
  const teste = await testFirebirdConnection(final);
  if (teste.ok && getCherpMode() !== 'firebird') {
    setCherpMode('firebird');
    logger.info('CHERP_MODE ativado automaticamente para "firebird" após conexão bem-sucedida salva em Configurações.');
  } else if (!teste.ok) {
    logger.warn({ message: teste.message }, 'Configuração do Firebird salva, mas a conexão de teste falhou — modo CHERP não foi alterado.');
  }
  return { cherpMode: getCherpMode() };
}

/**
 * Testa uma credencial sem persistir nem afetar o pool em uso. Senha vazia/mascarada (o
 * usuário clicou "Testar conexão" sem mexer no campo) usa a senha já salva — mesma regra
 * de `saveFirebirdSettings`, senão o teste testaria com senha em branco por engano.
 */
export async function testFirebirdConnection(input: FirebirdSettings): Promise<{ ok: boolean; message: string }> {
  const atual = await getFirebirdSettings();
  const password = !input.password || input.password === SENHA_MASCARADA ? atual.password : input.password;
  const resolved = { ...input, password };

  return new Promise((resolve) => {
    const options = { ...firebirdOptions, ...toFirebirdAttachOptions(resolved), lowercase_keys: false };
    const timeout = setTimeout(() => resolve({ ok: false, message: 'Tempo esgotado ao tentar conectar.' }), 8000);
    Firebird.attach(options, (err, attachedDb) => {
      clearTimeout(timeout);
      if (err) {
        logger.warn({ err }, 'Teste de conexão Firebird falhou');
        resolve({ ok: false, message: 'Não foi possível conectar com essas credenciais.' });
        return;
      }
      attachedDb.detach(() => resolve({ ok: true, message: 'Conexão bem-sucedida.' }));
    });
  });
}

export async function applyStoredFirebirdSettings(): Promise<void> {
  await migrateStoredSecrets();
  const stored = await getFirebirdSettings();
  await reloadFirebirdPool(toFirebirdAttachOptions(stored));
}

/** Migração compatível: converte credenciais legadas em texto puro no primeiro boot atualizado. */
export async function migrateStoredSecrets(): Promise<void> {
  for (const category of ['firebird', 'smtp'] as const) {
    const [row] = await db.select().from(settings).where(eq(settings.category, category));
    if (!row) continue;
    const data = row.data as { password?: unknown };
    if (typeof data.password !== 'string' || !data.password || data.password.startsWith(ENCRYPTED_PREFIX)) continue;
    await writeCategory(category, { ...data, password: encryptSecret(data.password) });
  }
}

export async function getSmtpSettings(): Promise<SmtpSettings> {
  const data = await readCategory('smtp', SMTP_PADRAO);
  return { ...data, password: decryptSecret(data.password) };
}

export async function getSmtpSettingsMasked(): Promise<SmtpSettings> {
  const data = await getSmtpSettings();
  return { ...data, password: data.password ? SENHA_MASCARADA : '' };
}

export async function saveSmtpSettings(input: SmtpSettings, usuario?: AuthenticatedUser, ctx: RequestContext = {}): Promise<void> {
  const atual = await getSmtpSettings();
  const password = !input.password || input.password === SENHA_MASCARADA ? atual.password : input.password;
  await writeCategory('smtp', { ...input, password: encryptSecret(password) });
  if (usuario) await auditSettings('SETTINGS_SMTP_UPDATED', usuario, ctx, {
    before: { ...atual, password: undefined }, after: { ...input, password: undefined }, passwordChanged: password !== atual.password,
  });
}

export async function isSmtpConfigured(): Promise<boolean> {
  const smtp = await getSmtpSettings();
  return Boolean(smtp.host && smtp.fromEmail);
}

function buildTransport(smtp: SmtpSettings) {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.seguranca === 'ssl',
    requireTLS: smtp.seguranca === 'starttls',
    auth: smtp.user ? { user: smtp.user, pass: smtp.password } : undefined,
  });
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const smtp = await getSmtpSettings();
  if (!smtp.host || !smtp.fromEmail) {
    throw new Error('SMTP não configurado.');
  }
  const transport = buildTransport(smtp);
  await transport.sendMail({ from: `"${smtp.fromName}" <${smtp.fromEmail}>`, to, subject, html });
}

export async function sendTestEmail(input: SmtpSettings, to: string): Promise<{ ok: boolean; message: string }> {
  try {
    const atual = await getSmtpSettings();
    const password = !input.password || input.password === SENHA_MASCARADA ? atual.password : input.password;
    const smtp = { ...input, password };
    const transport = buildTransport(smtp);
    await transport.sendMail({
      from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
      to,
      subject: 'Oeste Freios — e-mail de teste',
      html: '<p>Este é um e-mail de teste da configuração de SMTP do Oeste Freios.</p>',
    });
    return { ok: true, message: 'E-mail de teste enviado com sucesso.' };
  } catch (err) {
    logger.warn({ err }, 'Falha ao enviar e-mail de teste');
    return { ok: false, message: 'Não foi possível enviar o e-mail de teste com essas configurações.' };
  }
}

export async function getGeralSettings(): Promise<GeralSettings> {
  return readCategory('geral', GERAL_PADRAO);
}

export async function saveGeralSettings(input: GeralSettings, usuario?: AuthenticatedUser, ctx: RequestContext = {}): Promise<void> {
  const atual = await getGeralSettings();
  await writeCategory('geral', input);
  if (usuario) await auditSettings('SETTINGS_GERAL_UPDATED', usuario, ctx, {
    before: { nomeEmpresa: atual.nomeEmpresa, corDestaque: atual.corDestaque, fusoHorario: atual.fusoHorario },
    after: { nomeEmpresa: input.nomeEmpresa, corDestaque: input.corDestaque, fusoHorario: input.fusoHorario },
    logoChanged: input.logoUrl !== atual.logoUrl,
  });
}

export async function getIntegracoesSettings(): Promise<IntegracoesSettings> {
  const data = await readCategory('integracoes', INTEGRACOES_PADRAO);
  return {
    sintegraApiKey: decryptSecret(data.sintegraApiKey),
    dadosApiToken: decryptSecret(data.dadosApiToken),
  };
}

/** Versão segura pra devolver ao frontend — chave nunca volta em texto puro. */
export async function getIntegracoesSettingsMasked(): Promise<IntegracoesSettings> {
  const data = await getIntegracoesSettings();
  return {
    sintegraApiKey: data.sintegraApiKey ? SENHA_MASCARADA : '',
    dadosApiToken: data.dadosApiToken ? SENHA_MASCARADA : '',
  };
}

export async function getIntegrationSecret(key: keyof IntegracoesSettings): Promise<string> {
  return (await getIntegracoesSettings())[key];
}

export async function saveIntegracoesSettings(
  input: IntegracoesSettings,
  usuario?: AuthenticatedUser,
  ctx: RequestContext = {},
): Promise<void> {
  const atual = await getIntegracoesSettings();
  const sintegraApiKey = !input.sintegraApiKey || input.sintegraApiKey === SENHA_MASCARADA ? atual.sintegraApiKey : input.sintegraApiKey;
  const dadosApiToken = !input.dadosApiToken || input.dadosApiToken === SENHA_MASCARADA ? atual.dadosApiToken : input.dadosApiToken;
  await writeCategory('integracoes', {
    sintegraApiKey: encryptSecret(sintegraApiKey),
    dadosApiToken: encryptSecret(dadosApiToken),
  });
  if (usuario) await auditSettings('SETTINGS_INTEGRACOES_UPDATED', usuario, ctx, {
    sintegraApiKeyChanged: sintegraApiKey !== atual.sintegraApiKey,
    dadosApiTokenChanged: dadosApiToken !== atual.dadosApiToken,
  });
}
