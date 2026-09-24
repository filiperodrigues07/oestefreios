import { randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../auth/jwt.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { passwordPolicyErrors } from '../auth/passwordPolicy.js';
import type { LoginResponseDTO } from '../dto/auth.dto.js';
import { ValidationError } from '../errors/ValidationError.js';
import { UnauthorizedError } from '../errors/UnauthorizedError.js';
import { passwordResetTokenRepository } from '../repositories/postgres/PasswordResetTokenRepository.js';
import { refreshTokenRepository } from '../repositories/postgres/RefreshTokenRepository.js';
import { userRepository, type UserWithRole } from '../repositories/postgres/UserRepository.js';
import type { JwtPayload } from '../types/auth.types.js';
import { logger } from '../utils/logger.js';
import { parseDurationMs } from '../utils/parseDuration.js';
import type { RequestContext } from '../utils/requestContext.js';
import { recordAudit } from './auditLog.service.js';
import { adquirirVaga, garantirPresenca, liberar, sessaoUnicaAtiva, usuarioIsentoDeLimite } from './license.service.js';
import { isSmtpConfigured, sendEmail } from './settings.service.js';

function toJwtPayload(user: UserWithRole): JwtPayload {
  return {
    sub: user.id,
    email: user.email,
    name: user.name,
    roleId: user.roleId,
    roleName: user.roleName,
    permissions: user.permissions,
    sessionVersion: user.sessionVersion,
    mustChangePassword: user.mustChangePassword,
    cherpUsuarioChave: user.cherpUsuarioChave ?? undefined,
  };
}

function toLoginResponse(user: UserWithRole, accessToken: string): LoginResponseDTO {
  return {
    accessToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      photoUrl: user.photoUrl,
      roleId: user.roleId,
      roleName: user.roleName,
      permissions: user.permissions,
      mustChangePassword: user.mustChangePassword,
      cherpUsuarioChave: user.cherpUsuarioChave ?? undefined,
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

async function audit(event: string, userId: string | null, ctx: RequestContext, userName?: string) {
  await recordAudit({ userId, userName, event, ip: ctx.ip, userAgent: ctx.userAgent });
}

export async function login(email: string, password: string, ctx: RequestContext) {
  const user = await userRepository.findByEmail(email);

  // Mesma mensagem genérica para email inexistente ou senha errada — não enumera usuários.
  const genericError = () => new UnauthorizedError('Credenciais inválidas.', 'INVALID_CREDENTIALS');

  if (!user || !user.isActive) {
    await audit('LOGIN_FAILURE', user?.id ?? null, ctx, user?.name);
    throw genericError();
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    await audit('LOGIN_FAILURE', user.id, ctx, user.name);
    throw genericError();
  }

  // Licença simultânea: ocupa a vaga (ou falha com LICENSE_LIMIT_REACHED se as vagas acabaram).
  await adquirirVaga(user.id, usuarioIsentoDeLimite(user.roleName, user.permissions));

  // Sessão única por usuário: novo login derruba o dispositivo anterior.
  let sessionVersion = user.sessionVersion;
  if (sessaoUnicaAtiva() && (await refreshTokenRepository.countActiveForUser(user.id)) > 0) {
    await refreshTokenRepository.revokeAllForUser(user.id);
    await userRepository.bumpSessionVersion(user.id);
    // Releitura: o JWT novo precisa nascer já com a versão incrementada, senão cai na 1ª request.
    sessionVersion = (await userRepository.getSessionState(user.id))?.sessionVersion ?? sessionVersion + 1;
    await audit('SESSION_REPLACED', user.id, ctx, user.name);
  }

  const accessToken = signAccessToken(toJwtPayload({ ...user, sessionVersion }));
  const { refreshToken } = await issueRefreshToken(user.id, undefined, ctx);

  await audit('LOGIN_SUCCESS', user.id, ctx, user.name);

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
    if (stored.replacedByTokenId) {
      // Token já rotacionado sendo reapresentado: indício de roubo.
      await refreshTokenRepository.revokeFamily(stored.familyId);
      await audit('TOKEN_REUSE_DETECTED', payload.sub, ctx);
      throw new UnauthorizedError('Sessão inválida. Faça login novamente.', 'REFRESH_TOKEN_REUSED');
    }
    throw new UnauthorizedError('Sessão encerrada. Faça login novamente.', 'REFRESH_TOKEN_INVALID');
  }

  if (stored.expiresAt < new Date()) {
    throw new UnauthorizedError('Sessão expirada. Faça login novamente.', 'REFRESH_TOKEN_EXPIRED');
  }

  const user = await userRepository.findById(stored.userId);
  if (!user || !user.isActive) {
    throw new UnauthorizedError('Sessão expirada. Faça login novamente.', 'REFRESH_TOKEN_INVALID');
  }

  // Licença simultânea: presença expirada (ficou ocioso / F5 depois de muito tempo) disputa vaga de novo.
  const sessao = await userRepository.getSessionState(user.id);
  try {
    await garantirPresenca(user.id, sessao?.lastSeenAt ?? null, usuarioIsentoDeLimite(user.roleName, user.permissions));
  } catch (err) {
    await refreshTokenRepository.revokeFamily(stored.familyId);
    throw err;
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
    await liberar(stored.userId);
    await audit('LOGOUT', stored.userId, ctx);
  }
}

const RESET_TOKEN_TTL_MS = 45 * 60 * 1000;

/**
 * Sempre "sucede" do ponto de vista do chamador, exista ou não o e-mail — nunca revela se o
 * e-mail está cadastrado (mesma regra de não-enumeração já aplicada no login). Falha de SMTP
 * também não vaza pro chamador: fica só no log interno.
 */
export async function forgotPassword(email: string, ctx: RequestContext): Promise<void> {
  const user = await userRepository.findByEmail(email);
  if (!user || !user.isActive) return;

  const token = randomBytes(32).toString('hex');
  await passwordResetTokenRepository.create({
    userId: user.id,
    token,
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  });

  const link = `${env.FRONTEND_URL}/redefinir-senha?token=${token}`;
  try {
    await sendEmail(
      user.email,
      'Redefinição de senha — Oeste Freios',
      `<p>Olá, ${user.name}.</p>
       <p>Recebemos um pedido para redefinir sua senha. Clique no link abaixo — ele expira em 45 minutos:</p>
       <p><a href="${link}">${link}</a></p>
       <p>Se você não pediu essa redefinição, pode ignorar este e-mail.</p>`,
    );
    await audit('PASSWORD_RESET_REQUESTED', user.id, ctx, user.name);
  } catch (err) {
    logger.warn({ err }, 'Falha ao enviar e-mail de redefinição de senha (SMTP não configurado ou indisponível)');
  }
}

export async function resetPassword(token: string, newPassword: string, ctx: RequestContext): Promise<void> {
  const preview = await passwordResetTokenRepository.findValidByToken(token);
  if (!preview) {
    throw new ValidationError('Link de redefinição inválido ou expirado.');
  }
  const user = await userRepository.findById(preview.userId);
  const [passwordError] = passwordPolicyErrors(newPassword, { name: user?.name, email: user?.email });
  if (passwordError) throw new ValidationError(passwordError);
  const stored = await passwordResetTokenRepository.consumeValidToken(token);
  if (!stored) throw new ValidationError('Este link já foi utilizado.');

  const passwordHash = await hashPassword(newPassword);
  await userRepository.updatePasswordHash(stored.userId, passwordHash);
  // Redefinir a senha derruba todas as sessões ativas — quem "roubou" a sessão antiga não continua logado.
  await refreshTokenRepository.revokeAllForUser(stored.userId);

  await audit('PASSWORD_RESET_COMPLETED', stored.userId, ctx);
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string, ctx: RequestContext): Promise<void> {
  const user = await userRepository.findById(userId);
  if (!user || !(await verifyPassword(user.passwordHash, currentPassword))) {
    throw new ValidationError('A senha atual está incorreta.');
  }
  const [passwordError] = passwordPolicyErrors(newPassword, { name: user.name, email: user.email });
  if (passwordError) throw new ValidationError(passwordError);
  await userRepository.updatePasswordHash(userId, await hashPassword(newPassword));
  await refreshTokenRepository.revokeAllForUser(userId);
  await audit('PASSWORD_CHANGED', userId, ctx, user.name);
}

export async function isPasswordResetAvailable(): Promise<boolean> {
  return isSmtpConfigured();
}

/** Auto-edição de perfil (nome/e-mail) — qualquer usuário autenticado edita só a própria conta. */
export async function updateMyProfile(
  userId: string,
  input: { name: string; email: string },
  ctx: RequestContext,
): Promise<LoginResponseDTO> {
  const existing = await userRepository.findByEmail(input.email);
  if (existing && existing.id !== userId) {
    throw new ValidationError('Já existe um usuário cadastrado com este e-mail.');
  }

  await userRepository.update(userId, { name: input.name, email: input.email });
  await audit('PROFILE_UPDATED', userId, ctx, input.name);

  return getMe(userId);
}

/** URL da foto Ã© gravada somente para o prÃ³prio usuÃ¡rio autenticado. */
export async function updateMyProfilePhoto(userId: string, photoUrl: string, ctx: RequestContext): Promise<LoginResponseDTO> {
  await userRepository.update(userId, { photoUrl });
  await audit('PROFILE_PHOTO_UPDATED', userId, ctx);
  return getMe(userId);
}

export async function getMe(userId: string) {
  const user = await userRepository.findById(userId);
  if (!user || !user.isActive) {
    throw new UnauthorizedError('Sessão inválida.', 'UNAUTHORIZED');
  }
  return toLoginResponse(user, signAccessToken(toJwtPayload(user)));
}
