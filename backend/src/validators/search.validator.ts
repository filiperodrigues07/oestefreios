import { z } from 'zod';

/** Schema de busca genérico reaproveitado por produto/serviço/cliente/equipamento. */
export const searchQuerySchema = z.object({
  codigo: z.string().trim().min(1).optional(),
  descricao: z.string().trim().min(1).optional(),
  /** Só usado por equipamentos: filtra pelo cliente já selecionado no fluxo de criação de OS (seção 8). */
  clienteCodigo: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const codigoParamSchema = z.object({
  codigo: z.string().trim().min(1),
});
