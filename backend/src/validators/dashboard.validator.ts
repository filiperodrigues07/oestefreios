import { z } from 'zod';

export const dashboardOperacionalQuerySchema = z
  .object({
    inicio: z.coerce.date(),
    fim: z.coerce.date(),
    granularidade: z.enum(['diario', 'semanal', 'mensal']).default('diario'),
  })
  .refine(({ inicio, fim }) => inicio <= fim, { message: 'A data inicial deve ser anterior à data final.' })
  .refine(({ inicio, fim }) => (fim.getTime() - inicio.getTime()) / 86_400_000 <= 366, { message: 'O período máximo é de 366 dias.' });

export const dashboardBuscaQuerySchema = z.object({
  q: z.string().trim().min(2, 'Digite ao menos 2 caracteres.').max(80),
});
