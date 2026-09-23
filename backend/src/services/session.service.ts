import { and, eq, gt, isNull } from 'drizzle-orm';
import { UAParser } from 'ua-parser-js';
import { db } from '../database/postgres/client.js';
import { refreshTokens, users } from '../database/postgres/schema.js';
import type { ActiveSessionDTO } from '../dto/session.dto.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import { refreshTokenRepository } from '../repositories/postgres/RefreshTokenRepository.js';
import { userRepository } from '../repositories/postgres/UserRepository.js';
import type { AuthenticatedUser } from '../types/auth.types.js';
import type { RequestContext } from '../utils/requestContext.js';
import { recordAudit } from './auditLog.service.js';
import { liberar } from './license.service.js';

export async function listActiveSessions(): Promise<ActiveSessionDTO[]> {
  const rows = await db.select({ token: refreshTokens, user: users }).from(refreshTokens)
    .innerJoin(users, eq(refreshTokens.userId, users.id))
    .where(and(isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, new Date())));
  return rows.map(({ token, user }) => {
    const parsed = new UAParser(token.userAgent ?? '').getResult();
    return {
      id: token.id, userId: user.id, userName: user.name, userEmail: user.email,
      ip: token.createdByIp,
      os: [parsed.os.name, parsed.os.version].filter(Boolean).join(' ') || 'Desconhecido',
      browser: [parsed.browser.name, parsed.browser.version].filter(Boolean).join(' ') || 'Desconhecido',
      createdAt: token.createdAt.toISOString(), expiresAt: token.expiresAt.toISOString(),
      lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
    };
  });
}

async function audit(event: string, targetUserId: string, actor: AuthenticatedUser, ctx: RequestContext, sessionId?: string) {
  await recordAudit({ userId: actor.id, userName: actor.name, event, entityType: 'SESSION',
    entityId: targetUserId, changes: { sessionId, targetUserId }, ...ctx });
}

export async function forceLogoutSession(sessionId: string, actor: AuthenticatedUser, ctx: RequestContext): Promise<void> {
  const [token] = await db.select().from(refreshTokens)
    .where(and(eq(refreshTokens.id, sessionId), isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, new Date())));
  if (!token) throw new NotFoundError('Sessão ativa não encontrada.', 'SESSION_NOT_FOUND');
  await refreshTokenRepository.revokeFamily(token.familyId);
  await userRepository.bumpSessionVersion(token.userId);
  await liberar(token.userId);
  await audit('SESSION_FORCE_LOGOUT', token.userId, actor, ctx, token.id);
}

export async function forceLogoutAllForUser(userId: string, actor: AuthenticatedUser, ctx: RequestContext): Promise<void> {
  if (!await userRepository.findRowById(userId)) throw new NotFoundError('Usuário não encontrado.', 'USER_NOT_FOUND');
  await refreshTokenRepository.revokeAllForUser(userId);
  await userRepository.bumpSessionVersion(userId);
  await liberar(userId);
  await audit('SESSION_FORCE_LOGOUT_ALL', userId, actor, ctx);
}
