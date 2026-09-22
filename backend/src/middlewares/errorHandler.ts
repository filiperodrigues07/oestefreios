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
    return failure(res, err.code, err.message, err.statusCode, err.details);
  }

  if (err instanceof ZodError) {
    return failure(res, 'VALIDATION_ERROR', 'Dados inválidos.', 400);
  }

  const gdscode = extractGdscode(err);
  const mapped = gdscode !== undefined ? FIREBIRD_ERROR_MESSAGES[gdscode] : undefined;
  if (mapped) {
    logger.error({ err, requestId: req.requestId, gdscode }, 'Erro nativo do Firebird');
    return failure(res, mapped.code, mapped.message, mapped.statusCode);
  }

  logger.error({ err, requestId: req.requestId }, 'Erro não tratado');
  return failure(res, 'INTERNAL_ERROR', 'Ocorreu um erro inesperado. Tente novamente.', 500);
}

/**
 * Gdscodes mais comuns de violação de constraint no Firebird — a checagem de duplicidade explícita
 * (ver ConflictError em cliente/equipamento.service.ts) cobre o caminho feliz; isto é a rede de
 * segurança pra constraint que a gente não previu (nunca deixa SQL/gdscode cru chegar no cliente).
 */
const FIREBIRD_ERROR_MESSAGES: Record<number, { code: string; message: string; statusCode: number }> = {
  335544665: { code: 'DUPLICATE_KEY', message: 'Já existe um registro com esses dados no CHERP.', statusCode: 409 },
  335544466: { code: 'REFERENCE_CONFLICT', message: 'Esse registro está vinculado a outro no CHERP e não pode ser alterado dessa forma.', statusCode: 409 },
  335544347: { code: 'VALIDATION_ERROR', message: 'Algum campo obrigatório não foi preenchido corretamente.', statusCode: 400 },
};

function extractGdscode(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null || !('gdscode' in err)) return undefined;
  const value = (err as { gdscode: unknown }).gdscode;
  return typeof value === 'number' ? value : undefined;
}
