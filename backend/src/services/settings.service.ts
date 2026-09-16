import * as Firebird from 'node-firebird';
import nodemailer from 'nodemailer';
import { eq } from 'drizzle-orm';
import { env } from '../config/env.js';
import { firebirdOptions } from '../config/firebird.config.js';
import { reloadFirebirdPool } from '../database/firebird/pool.js';
import { db } from '../database/postgres/client.js';
import { settings } from '../database/postgres/schema.js';
import { logger } from '../utils/logger.js';

const SENHA_MASCARADA = '••••••••';

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
  return readCategory('firebird', FIREBIRD_PADRAO);
}

/** Versão segura pra devolver ao frontend — senha nunca volta em texto puro. */
export async function getFirebirdSettingsMasked(): Promise<FirebirdSettings> {
  const data = await getFirebirdSettings();
  return { ...data, password: data.password ? SENHA_MASCARADA : '' };
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

export async function saveFirebirdSettings(input: FirebirdSettings): Promise<void> {
  const atual = await getFirebirdSettings();
  const password = !input.password || input.password === SENHA_MASCARADA ? atual.password : input.password;
  const final: FirebirdSettings = { ...input, password };
  await writeCategory('firebird', final);
  await reloadFirebirdPool(toFirebirdAttachOptions(final));
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
  const stored = await getFirebirdSettings();
  await reloadFirebirdPool(toFirebirdAttachOptions(stored));
}

export async function getSmtpSettings(): Promise<SmtpSettings> {
  return readCategory('smtp', SMTP_PADRAO);
}

export async function getSmtpSettingsMasked(): Promise<SmtpSettings> {
  const data = await getSmtpSettings();
  return { ...data, password: data.password ? SENHA_MASCARADA : '' };
}

export async function saveSmtpSettings(input: SmtpSettings): Promise<void> {
  const atual = await getSmtpSettings();
  const password = !input.password || input.password === SENHA_MASCARADA ? atual.password : input.password;
  await writeCategory('smtp', { ...input, password });
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

export async function saveGeralSettings(input: GeralSettings): Promise<void> {
  await writeCategory('geral', input);
}
