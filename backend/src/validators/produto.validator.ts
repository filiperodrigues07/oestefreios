import { z } from 'zod';

export const produtoSearchQuerySchema = z.object({
  codigo: z.string().trim().min(1).optional(),
  descricao: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const produtoCodigoParamSchema = z.object({
  codigo: z.string().trim().min(1),
});
