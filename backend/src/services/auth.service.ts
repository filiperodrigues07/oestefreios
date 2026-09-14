import { env } from '../config/env.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../auth/jwt.js';
import { verifyPassword } from '../auth/password.js';
import type { LoginResponseDTO } from '../dto/auth.dto.js';
import { db } from '../database/postgres/client.js';
import { auditLogs } from '../database/postgres/schema.js';
import { UnauthorizedError } from '../errors/UnauthorizedError.js';
import { refreshTokenRepository } from '../repositories/postgres/RefreshTokenRepository.js';
import { userRepository, type UserWithRole } from '../repositories/postgres/UserRepository.js';
import type { JwtPayload } from '../types/auth.types.js';
import { parseDurationMs } from '../utils/parseDuration.js';

interface RequestContext {
  ip?: string;
  userAgent?: string;
}

function toJwtPayload(user: UserWithRole): JwtPayload {
  return {
    sub: user.id,
    email: user.email,
    name: user.name,
    roleId: user.roleId,
    roleName: user.roleName,
    permissions: user.permissions,
  };
}

function toLoginResponse(user: UserWithRole, accessToken: string): LoginResponseDTO {
  return {
    accessToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      roleId: user.roleId,
      roleName: user.roleName,
      permissions: user.permissions,
    },
  };
}

async function issueRefreshToken(userId: string, familyId: string | undefined, ctx: RequestContext) {
  const refreshToken = signRefreshToken({ sub: userId, tokenId: crypto.randomUUID() });
  const expiresAt = new Date(Date.now() + parseDurationMs(env.JWT_REFRESH_EXPIRES_IN));
  const row = await refreshTokenRepository.create({
    userId,
    token: refreshToken,
    familyId,
    expiresAt,
    createdByIp: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return { refreshToken, familyId: row.familyId };
}

async function audit(event: string, userId: string | null, ctx: RequestContext) {
  await db.insert(auditLogs).values({ userId, event, ip: ctx.ip, userAgent: ctx.userAgent });
}

export async function login(email: string, password: string, ctx: RequestContext) {
  const user = await userRepository.findByEmail(email);

  // Mesma mensagem genérica para email inexistente ou senha errada — não enumera usuários.
  const genericError = () => new UnauthorizedError('Credenciais inválidas.', 'INVALID_CREDENTIALS');

  if (!user || !user.isActive) {
    await audit('LOGIN_FAILURE', user?.id ?? null, ctx);
    throw genericError();
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    await audit('LOGIN_FAILURE', user.id, ctx);
    throw genericError();
  }

  const accessToken = signAccessToken(toJwtPayload(user));
  const { refreshToken } = await issueRefreshToken(user.id, undefined, ctx);

  await audit('LOGIN_SUCCESS', user.id, ctx);

  return { response: toLoginResponse(user, accessToken), refreshToken };
}

export async function refresh(currentRefreshToken: string, ctx: RequestContext) {
  let payload: { sub: string; tokenId: string };
  try {
    payload = verifyRefreshToken(currentRefreshToken);
  } catch {
    throw new UnauthorizedError('Sessão expirada. Faça login novamente.', 'REFRESH_TOKEN_INVALID');
  }

  const stored = await refreshTokenRepository.findByToken(currentRefreshToken);
  if (!stored) {
    throw new UnauthorizedError('Sessão expirada. Faça login novamente.', 'REFRESH_TOKEN_INVALID');
  }

  if (stored.revokedAt) {
    // Token já rotacionado sendo reapresentado: indício de roubo. Revoga a família inteira.
    await refreshTokenRepository.revokeFamily(stored.familyId);
    await audit('TOKEN_REUSE_DETECTED', payload.sub, ctx);
    throw new UnauthorizedError('Sessão inválida. Faça login novamente.', 'REFRESH_TOKEN_REUSED');
  }

  if (stored.expiresAt < new Date()) {
    throw new UnauthorizedError('Sessão expirada. Faça login novamente.', 'REFRESH_TOKEN_EXPIRED');
  }

  const user = await userRepository.findById(stored.userId);
  if (!user || !user.isActive) {
    throw new UnauthorizedError('Sessão expirada. Faça login novamente.', 'REFRESH_TOKEN_INVALID');
  }

  const { refreshToken: newRefreshToken } = await issueRefreshToken(user.id, stored.familyId, ctx);
  const newRow = await refreshTokenRepository.findByToken(newRefreshToken);
  await refreshTokenRepository.revoke(stored.id, newRow?.id);

  const accessToken = signAccessToken(toJwtPayload(user));

  return { response: toLoginResponse(user, accessToken), refreshToken: newRefreshToken };
}

export async function logout(currentRefreshToken: string | undefined, ctx: RequestContext) {
  if (!currentRefreshToken) return;
  const stored = await refreshTokenRepository.findByToken(currentRefreshToken);
  if (stored && !stored.revokedAt) {
    await refreshTokenRepository.revoke(stored.id);
    await audit('LOGOUT', stored.userId, ctx);
  }
}

export async function getMe(userId: string) {
  const user = await userRepository.findById(userId);
  if (!user || !user.isActive) {
    throw new UnauthorizedError('Sessão inválida.', 'UNAUTHORIZED');
  }
  return toLoginResponse(user, signAccessToken(toJwtPayload(user)));
}
