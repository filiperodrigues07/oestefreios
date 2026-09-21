import { z } from 'zod';

export const listarAuditLogsQuerySchema = z.object({
  entityType: z.string().trim().min(1).optional(),
  event: z.string().trim().min(1).optional(),
  categoria: z.enum(['AUTH', 'OS', 'USER', 'CLIENTE', 'VEICULO', 'SETTINGS', 'SESSION']).optional(),
  dataInicial: z.coerce.date().optional(),
  dataFinal: z.coerce.date().optional(),
  userId: z.string().uuid().optional(),
  usuario: z.string().trim().min(1).optional(),
  busca: z.string().trim().min(1).optional(),
  formato: z.enum(['json', 'excel']).default('json'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
