import { z } from 'zod';

export const equipamentoInputSchema = z.object({
  clienteCodigo: z.string().trim().min(1, 'Cliente é obrigatório.'),
  placa: z.string().trim().min(1, 'Placa é obrigatória.'),
  marca: z.string().trim().optional(),
  modelo: z.string().trim().optional(),
  anoFabricacao: z.string().trim().optional(),
  anoModelo: z.string().trim().optional(),
  cor: z.string().trim().optional(),
  chassi: z.string().trim().optional(),
  kmAtual: z.coerce.number().int().nonnegative().optional(),
});
