import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError } from '../errors/ForbiddenError.js';
import { UnauthorizedError } from '../errors/UnauthorizedError.js';
import type { Permission } from '../types/auth.types.js';

/**
 * Exige que req.user (populado por `authenticate`) tenha a permissão informada.
 * Nunca confia em role/permissão enviada pelo frontend — só no que está no JWT assinado pelo servidor.
 */
export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new UnauthorizedError();
    }
    if (!req.user.permissions.includes(permission)) {
      throw new ForbiddenError(`Permissão necessária: ${permission}.`);
    }
    next();
  };
}
