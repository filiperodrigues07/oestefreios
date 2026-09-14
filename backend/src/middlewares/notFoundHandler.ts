import type { Request, Response } from 'express';
import { failure } from '../utils/apiResponse.js';

export function notFoundHandler(req: Request, res: Response) {
  failure(res, 'ROUTE_NOT_FOUND', `Rota ${req.method} ${req.originalUrl} não encontrada.`, 404);
}
