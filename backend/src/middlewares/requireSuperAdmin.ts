import type { NextFunction, Request, Response } from 'express';
import { NotFoundError } from '../errors/NotFoundError.js';
import { UnauthorizedError } from '../errors/UnauthorizedError.js';

/**
 * Só o proprietário do sistema (users.is_super_admin, lido do banco por `authenticate`). Devolve 404
 * — e não 403 — para quem não é: a área nem existe para os demais usuários.
 */
export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) throw new UnauthorizedError();
  if (!req.user.isSuperAdmin) throw new NotFoundError('Recurso não encontrado.', 'NOT_FOUND');
  next();
}
