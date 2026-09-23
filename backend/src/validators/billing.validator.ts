import { z } from 'zod';

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD.');

export const billingUpdateSchema = z.object({
  cliente: z.string().trim().max(120),
  plano: z.string().trim().max(80),
  valorMensal: z.coerce.number().min(0).max(1_000_000),
  vencimentoAtual: dataIso.nullable(),
  diaVencimento: z.coerce.number().int().min(1).max(31),
  carenciaDias: z.coerce.number().int().min(0).max(60),
  avisoDias: z.coerce.number().int().min(0).max(60),
});

export const novoPagamentoSchema = z.object({
  data: dataIso,
  referencia: z.string().trim().regex(/^\d{4}-\d{2}$/, 'Use o formato AAAA-MM.'),
  valor: z.coerce.number().min(0).max(1_000_000),
  forma: z.enum(['PIX', 'BOLETO', 'DINHEIRO', 'OUTRO']),
  observacao: z.string().trim().max(300).default(''),
});
