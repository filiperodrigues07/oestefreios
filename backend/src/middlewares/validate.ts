import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

type Source = 'body' | 'query' | 'params';

/**
 * Valida req[source] contra um schema Zod; substitui pelo dado parseado (com defaults/coerções aplicadas).
 * No Express 5, `req.query` é um getter sem setter — precisa de defineProperty em vez de atribuição direta.
 */
export function validate(schema: ZodType, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.parse(req[source]);
    Object.defineProperty(req, source, { value: parsed, writable: true, configurable: true, enumerable: true });
    next();
  };
}
