import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../auth/jwt.js';
import { UnauthorizedError } from '../errors/UnauthorizedError.js';

/** Exige um Bearer JWT válido; popula req.user com o payload embutido no token. */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Token de acesso ausente.', 'MISSING_TOKEN');
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      roleId: payload.roleId,
      roleName: payload.roleName,
      permissions: payload.permissions,
    };
    next();
  } catch {
    throw new UnauthorizedError('Token de acesso expirado ou inválido.', 'TOKEN_EXPIRED');
  }
}
