import { z } from 'zod';

export const clienteInputSchema = z.object({
  tipoPessoa: z.enum(['PF', 'PJ']),
  nome: z.string().trim().min(1, 'Nome é obrigatório.'),
  nomeFantasia: z.string().trim().optional(),
  documento: z.string().trim().min(1, 'CPF/CNPJ é obrigatório.'),
  telefone: z.string().trim().optional(),
  email: z.email().optional().or(z.literal('')),
  endereco: z.string().trim().optional(),
  numero: z.string().trim().optional(),
  bairro: z.string().trim().optional(),
  complemento: z.string().trim().optional(),
  cidade: z.string().trim().optional(),
  uf: z.string().trim().length(2).optional(),
  cep: z.string().trim().optional(),
  fornecedor: z.boolean().default(false),
  transportador: z.boolean().default(false),
  representante: z.boolean().default(false),
  regimeTributario: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
});

export const cnpjParamSchema = z.object({
  cnpj: z
    .string()
    .trim()
    .transform((s) => s.replace(/\D/g, ''))
    .refine((s) => s.length === 14, 'CNPJ precisa ter 14 dígitos.'),
});
