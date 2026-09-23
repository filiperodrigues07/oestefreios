import { z } from 'zod';
import { toUppercase } from './textTransform.js';

export const equipamentoInputSchema = z.object({
  clienteCodigo: z.string().trim().min(1, 'Cliente é obrigatório.'),
  placa: z.string().trim().min(1, 'Placa é obrigatória.').transform(toUppercase),
  marca: z.string().trim().transform(toUppercase).optional(),
  modelo: z.string().trim().transform(toUppercase).optional(),
  anoFabricacao: z.string().trim().optional(),
  anoModelo: z.string().trim().optional(),
  cor: z.string().trim().transform(toUppercase).optional(),
  chassi: z.string().trim().transform(toUppercase).optional(),
  kmAtual: z.coerce.number().int().nonnegative().optional(),
  versao: z.string().trim().transform(toUppercase).optional(),
  combustivel: z.string().trim().transform(toUppercase).optional(),
  municipio: z.string().trim().transform(toUppercase).optional(),
  uf: z.string().trim().transform(toUppercase).optional(),
  motor: z.string().trim().transform(toUppercase).optional(),
  codigoFipe: z.string().trim().optional(),
});
