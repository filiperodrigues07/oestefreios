import { z } from 'zod';

/** Texto vindo do navegador: corta em vez de rejeitar — um stack gigante ainda vale ser logado. */
const texto = (max: number) => z.string().transform((v) => v.slice(0, max));

export const clientErrorSchema = z.object({
  source: z.enum(['boundary', 'route', 'window', 'promise']),
  message: texto(2000),
  stack: texto(8000).optional(),
  componentStack: texto(4000).optional(),
  url: texto(500),
  version: texto(40).optional(),
  userId: texto(64).optional(),
});

export type ClientErrorInput = z.infer<typeof clientErrorSchema>;
