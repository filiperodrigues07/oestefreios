import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError.js';
import { failure } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';

/** Handler central de erros. Nunca expõe stack trace ao cliente. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error({ err, requestId: req.requestId }, 'Erro não operacional');
    }
    return failure(res, err.code, err.message, err.statusCode);
  }

  if (err instanceof ZodError) {
    return failure(res, 'VALIDATION_ERROR', 'Dados inválidos.', 400);
  }

  logger.error({ err, requestId: req.requestId }, 'Erro não tratado');
  return failure(res, 'INTERNAL_ERROR', 'Ocorreu um erro inesperado. Tente novamente.', 500);
}
