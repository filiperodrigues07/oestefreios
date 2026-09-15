import { z } from 'zod';

export const listarAuditLogsQuerySchema = z.object({
  entityType: z.string().trim().min(1).optional(),
  event: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
