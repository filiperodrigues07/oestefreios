import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../auth/jwt.js';
import { UnauthorizedError } from '../errors/UnauthorizedError.js';
import { userRepository } from '../repositories/postgres/UserRepository.js';
import { garantirPresenca, usuarioIsentoDeLimite } from '../services/license.service.js';

/** Exige um Bearer JWT válido; popula req.user com o payload embutido no token. */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Token de acesso ausente.', 'MISSING_TOKEN');
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = verifyAccessToken(token);
    if (payload.sessionVersion !== undefined) {
      const session = await userRepository.getSessionState(payload.sub);
      if (!session?.isActive || session.sessionVersion !== payload.sessionVersion) {
        throw new UnauthorizedError('Sessão revogada. Faça login novamente.', 'SESSION_REVOKED');
      }
      // Presença da licença simultânea (renova a cada ~1 min; se a presença expirou, disputa vaga de novo).
      await garantirPresenca(payload.sub, session.lastSeenAt, usuarioIsentoDeLimite(payload.roleName, payload.permissions));
    }
    const passwordChangeAllowed = ['/api/auth/change-password', '/api/auth/logout', '/api/auth/me'].includes(req.originalUrl.split('?')[0]!);
    if (payload.mustChangePassword && !passwordChangeAllowed) {
      throw new UnauthorizedError('Altere sua senha inicial antes de continuar.', 'PASSWORD_CHANGE_REQUIRED');
    }
    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      roleId: payload.roleId,
      roleName: payload.roleName,
      permissions: payload.permissions,
      mustChangePassword: payload.mustChangePassword ?? false,
      cherpUsuarioChave: payload.cherpUsuarioChave,
    };
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError('Token de acesso expirado ou inválido.', 'TOKEN_EXPIRED');
  }
}
