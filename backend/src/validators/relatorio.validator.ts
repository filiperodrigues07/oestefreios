import { z } from 'zod';
import { calendarEndSchema, calendarStartSchema } from './calendarDate.js';

const formatoSchema = z.enum(['json', 'excel', 'pdf']).default('json');

export const relatorioOSQuerySchema = z
  .object({
    dataInicial: calendarStartSchema,
    dataFinal: calendarEndSchema,
    dataReferencia: z.enum(['abertura', 'conclusao']).default('abertura'),
    status: z.string().trim().min(1).optional(),
    situacaoDocumento: z.coerce.number().int().min(0).max(6).optional(),
    prioridade: z.string().trim().min(1).optional(),
    busca: z.string().trim().min(1).optional(),
    formato: formatoSchema,
  })
  .refine(({ dataInicial, dataFinal }) => dataInicial <= dataFinal, {
    message: 'A data inicial deve ser anterior à data final.',
  })
  .refine(({ dataInicial, dataFinal }) => (dataFinal.getTime() - dataInicial.getTime()) / 86_400_000 <= 366, {
    message: 'O período máximo é de 366 dias.',
  });

export const relatorioClientesQuerySchema = z.object({
  tipoPessoa: z.enum(['PF', 'PJ']).optional(),
  uf: z.string().trim().length(2).optional(),
  busca: z.string().trim().min(1).optional(),
  formato: formatoSchema,
});

export const relatorioVeiculosQuerySchema = z.object({
  busca: z.string().trim().min(1).optional(),
  clienteCodigo: z.string().trim().min(1).optional(),
  anoFabricacao: z.coerce.number().int().optional(),
  formato: formatoSchema,
});

export const relatorioCatalogoQuerySchema = z.object({
  busca: z.string().trim().min(1).optional(),
  tipoCodigo: z.coerce.number().int().nonnegative().optional(),
  tipoModo: z.enum(['somente', 'exceto']).optional(),
  saldoModo: z.enum(['todos', 'com_saldo', 'sem_saldo', 'negativo']).optional(),
  formato: formatoSchema,
});

export const relatorioProdutosServicosQuerySchema = z
  .object({
    dataInicial: calendarStartSchema,
    dataFinal: calendarEndSchema,
    dataReferencia: z.enum(['abertura', 'conclusao']).default('abertura'),
    formato: formatoSchema,
  })
  .refine(({ dataInicial, dataFinal }) => dataInicial <= dataFinal, {
    message: 'A data inicial deve ser anterior à data final.',
  })
  .refine(({ dataInicial, dataFinal }) => (dataFinal.getTime() - dataInicial.getTime()) / 86_400_000 <= 366, {
    message: 'O período máximo é de 366 dias.',
  });
