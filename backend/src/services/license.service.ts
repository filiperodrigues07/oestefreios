import { and, desc, eq, gt, isNull, ne, sql } from 'drizzle-orm';
import { UAParser } from 'ua-parser-js';
import { env } from '../config/env.js';
import { readCategory, writeCategory } from './settings.service.js';
import { db } from '../database/postgres/client.js';
import { refreshTokens, roles, users } from '../database/postgres/schema.js';
import { UnauthorizedError } from '../errors/UnauthorizedError.js';

/**
 * Licença simultânea por presença: "online" = atividade autenticada nos últimos
 * LICENSE_IDLE_MINUTES (`users.last_seen_at`). Não conta token de refresh vivo (vale 7 dias e
 * ficaria contando quem fechou o navegador). Cada usuário tem uma sessão só (o login derruba a
 * anterior), então vaga = usuário.
 */

const PRESENCE_TOUCH_MS = 60_000;
const ONLINE_RECENTE_MS = 5 * 60_000;

export type DecisaoVaga = 'renovar' | 'ocupar' | 'bloquear';

/** Regra pura, isolada pra teste: `online` já exclui o próprio usuário. */
export function decidirVaga(input: { online: number; limite: number; isento: boolean; jaOnline: boolean }): DecisaoVaga {
  if (input.jaOnline) return 'renovar';
  if (input.isento || input.limite === 0) return 'ocupar';
  return input.online >= input.limite ? 'bloquear' : 'ocupar';
}

/** Só o proprietário (super admin) nunca fica de fora — senão a licença lotada o trancaria, e ninguém mais é isento (nem outro Administrador). */
export function usuarioIsentoDeLimite(isSuperAdmin: boolean): boolean {
  return isSuperAdmin;
}

export interface LicencaConfig {
  /** 0 = sem limite. */
  limite: number;
  idleMinutes: number;
  sessaoUnica: boolean;
}

export interface LicencaConfigDetalhada extends LicencaConfig {
  /** De onde vem cada valor: 'painel' (salvo pelo proprietário) ou 'env' (padrão do servidor). */
  origem: { limite: 'painel' | 'env'; idleMinutes: 'painel' | 'env'; sessaoUnica: 'painel' | 'env' };
}

const CACHE_LICENCA_MS = 60_000;
let cacheLicenca: { salvo: Partial<LicencaConfig>; em: number } | null = null;

export function invalidarCacheLicenca(): void {
  cacheLicenca = null;
}

async function licencaSalva(): Promise<Partial<LicencaConfig>> {
  if (cacheLicenca && Date.now() - cacheLicenca.em < CACHE_LICENCA_MS) return cacheLicenca.salvo;
  const salvo = await readCategory<Partial<LicencaConfig>>('licenca', {});
  cacheLicenca = { salvo, em: Date.now() };
  return salvo;
}

/**
 * Valor salvo pelo proprietário no painel; sem ele, cai no .env (lido de process.env a cada chamada,
 * não do `env` parseado no boot, pra testes poderem ligar/desligar). O cache guarda só a linha do banco.
 */
export async function getLicencaConfigDetalhada(): Promise<LicencaConfigDetalhada> {
  const salvo = await licencaSalva();
  const limite = salvo.limite;
  const idle = salvo.idleMinutes;
  const unica = salvo.sessaoUnica;
  return {
    limite: limite ?? Number(process.env.LICENSE_MAX_SESSIONS ?? env.LICENSE_MAX_SESSIONS),
    idleMinutes: idle ?? Number(process.env.LICENSE_IDLE_MINUTES ?? env.LICENSE_IDLE_MINUTES),
    sessaoUnica: unica ?? process.env.SINGLE_SESSION_PER_USER !== 'false',
    origem: {
      limite: limite === undefined ? 'env' : 'painel',
      idleMinutes: idle === undefined ? 'env' : 'painel',
      sessaoUnica: unica === undefined ? 'env' : 'painel',
    },
  };
}

export async function getLicencaConfig(): Promise<LicencaConfig> {
  const { origem: _origem, ...config } = await getLicencaConfigDetalhada();
  return config;
}

export async function salvarLicencaConfig(config: LicencaConfig): Promise<LicencaConfigDetalhada> {
  await writeCategory('licenca', config);
  invalidarCacheLicenca();
  return getLicencaConfigDetalhada();
}

export async function sessaoUnicaAtiva(): Promise<boolean> {
  return (await getLicencaConfig()).sessaoUnica;
}

function corteOnline(idleMinutes: number, agora = Date.now()): Date {
  return new Date(agora - idleMinutes * 60_000);
}

function erroLimite(limite: number): UnauthorizedError {
  return new UnauthorizedError(
    `Limite de licenças em uso (${limite}/${limite}). Peça a um administrador para liberar uma vaga ou tente novamente em alguns minutos.`,
    'LICENSE_LIMIT_REACHED',
  );
}

/** Ocupa (ou renova) a vaga do usuário; lança `LICENSE_LIMIT_REACHED` se as vagas acabaram. */
export async function adquirirVaga(userId: string, isento: boolean): Promise<void> {
  const cfg = await getLicencaConfig();
  await db.transaction(async (tx) => {
    // Serializa logins simultâneos — sem isso dois logins no limite passariam juntos.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('license-seats'))`);
    const corte = corteOnline(cfg.idleMinutes);
    const [atual] = await tx.select({ lastSeenAt: users.lastSeenAt }).from(users).where(eq(users.id, userId));
    const jaOnline = Boolean(atual?.lastSeenAt && atual.lastSeenAt > corte);
    const [linha] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.isActive, true), gt(users.lastSeenAt, corte), ne(users.id, userId)));
    const decisao = decidirVaga({ online: linha?.total ?? 0, limite: cfg.limite, isento, jaOnline });
    if (decisao === 'bloquear') throw erroLimite(cfg.limite);
    await tx.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, userId));
  });
}

/**
 * Chamada a cada request autenticado: presença fresca (<1 min) não escreve nada; entre 1 min e
 * o limite de inatividade só renova; presença expirada/nula reabre a disputa por vaga.
 */
export async function garantirPresenca(userId: string, lastSeenAt: Date | null, isento: boolean): Promise<void> {
  const agora = Date.now();
  if (lastSeenAt) {
    const idade = agora - lastSeenAt.getTime();
    if (idade < PRESENCE_TOUCH_MS) return;
    const { idleMinutes } = await getLicencaConfig();
    if (idade < idleMinutes * 60_000) {
      await db.update(users).set({ lastSeenAt: new Date(agora) }).where(eq(users.id, userId));
      return;
    }
  }
  await adquirirVaga(userId, isento);
}

/** Logout / sessão derrubada: a vaga volta na hora. */
export async function liberar(userId: string): Promise<void> {
  await db.update(users).set({ lastSeenAt: null }).where(eq(users.id, userId));
}

export type StatusPresenca = 'online' | 'ocioso' | 'offline';

export interface UsuarioLicenca {
  id: string;
  name: string;
  email: string;
  roleName: string;
  photoUrl: string | null;
  isSuperAdmin: boolean;
  status: StatusPresenca;
  lastSeenAt: string | null;
  sessao: { id: string; ip: string | null; os: string; browser: string; loginAt: string } | null;
}

export interface ResumoLicenca {
  limite: number;
  emUso: number;
  idleMinutes: number;
  usuarios: UsuarioLicenca[];
}

/** online = atividade recente; ocioso = ainda ocupa vaga mas parado; offline = sem vaga. */
export function statusDePresenca(lastSeenAt: Date | null, agora = Date.now(), idleMinutes = env.LICENSE_IDLE_MINUTES): StatusPresenca {
  if (!lastSeenAt) return 'offline';
  const idade = agora - lastSeenAt.getTime();
  if (idade >= idleMinutes * 60_000) return 'offline';
  if (idade < ONLINE_RECENTE_MS) return 'online';
  return 'ocioso';
}

const ORDEM_STATUS: Record<StatusPresenca, number> = { online: 0, ocioso: 1, offline: 2 };

export async function getResumoLicenca(): Promise<ResumoLicenca> {
  const cfg = await getLicencaConfig();
  const [linhas, tokens] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        photoUrl: users.photoUrl,
        roleName: roles.name,
        isSuperAdmin: users.isSuperAdmin,
        lastSeenAt: users.lastSeenAt,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.isActive, true)),
    db
      .select()
      .from(refreshTokens)
      .where(and(isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, new Date())))
      .orderBy(desc(refreshTokens.createdAt)),
  ]);
  const sessaoPorUsuario = new Map<string, (typeof tokens)[number]>();
  for (const token of tokens) if (!sessaoPorUsuario.has(token.userId)) sessaoPorUsuario.set(token.userId, token);

  const agora = Date.now();
  const lista: UsuarioLicenca[] = linhas.map((row) => {
    const status = statusDePresenca(row.lastSeenAt, agora, cfg.idleMinutes);
    const token = sessaoPorUsuario.get(row.id);
    const ua = new UAParser(token?.userAgent ?? '').getResult();
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      roleName: row.roleName,
      photoUrl: row.photoUrl,
      isSuperAdmin: row.isSuperAdmin,
      status,
      lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
      sessao: token
        ? {
            id: token.id,
            ip: token.createdByIp,
            os: [ua.os.name, ua.os.version].filter(Boolean).join(' ') || 'Desconhecido',
            browser: [ua.browser.name, ua.browser.version].filter(Boolean).join(' ') || 'Desconhecido',
            loginAt: token.createdAt.toISOString(),
          }
        : null,
    };
  });
  lista.sort((a, b) => ORDEM_STATUS[a.status] - ORDEM_STATUS[b.status] || a.name.localeCompare(b.name, 'pt-BR'));
  return {
    limite: cfg.limite,
    emUso: lista.filter((u) => u.status !== 'offline').length,
    idleMinutes: cfg.idleMinutes,
    usuarios: lista,
  };
}
