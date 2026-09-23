import { z } from 'zod';
import { toUppercase } from './textTransform.js';
import { calendarEndSchema, calendarStartSchema } from './calendarDate.js';

const OS_STATUS_VALUES = [
  'ABERTA',
  'EM_ANALISE',
  'EM_ANDAMENTO',
  'AGUARDANDO_PECA',
  'AGUARDANDO_CLIENTE',
  'CONCLUIDA',
  'CANCELADA',
] as const;

const OS_PRIORIDADE_VALUES = ['BAIXA', 'NORMAL', 'MEDIA', 'ALTA', 'URGENTE'] as const;

export const criarOSSchema = z.object({
  clienteCodigo: z.string().trim().min(1, 'Cliente é obrigatório.'),
  equipamentoCodigo: z.string().trim().min(1, 'Equipamento é obrigatório.'),
  problema: z.string().trim().transform(toUppercase).optional().default(''),
  prioridade: z.enum(OS_PRIORIDADE_VALUES).default('NORMAL'),
  responsavelId: z.string().trim().min(1).optional(),
  tecnicoId: z.string().trim().min(1).optional(),
  dataPrevista: z.iso.datetime().optional(),
});

export const atualizarOSSchema = z
  .object({
    diagnostico: z.string().trim().transform(toUppercase).optional(),
    observacoes: z.string().trim().transform(toUppercase).optional(),
    solucao: z.string().trim().transform(toUppercase).optional(),
    prioridade: z.enum(OS_PRIORIDADE_VALUES).optional(),
    responsavelId: z.string().trim().min(1).optional(),
    tecnicoId: z.string().trim().min(1).optional(),
    dataPrevista: z.iso.datetime().optional(),
    kmAtual: z.coerce.number().nonnegative().optional(),
    kmFinal: z.coerce.number().nonnegative().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Nenhum campo para atualizar.' });

export const alterarStatusSchema = z.object({
  status: z.enum(OS_STATUS_VALUES),
});

export const osIdParamSchema = z.object({
  id: z.string().trim().min(1),
});

export const osItemProdutoParamSchema = z.object({
  id: z.string().trim().min(1),
  produtoCodigo: z.string().trim().min(1),
});

export const osItemServicoParamSchema = z.object({
  id: z.string().trim().min(1),
  servicoCodigo: z.string().trim().min(1),
});

export const osImagemParamSchema = z.object({
  id: z.string().trim().min(1),
  identificador: z.string().trim().min(1),
});

export const adicionarProdutoSchema = z.object({
  produtoCodigo: z.string().trim().min(1),
  quantidade: z.coerce.number().positive().default(1),
  /** Só aplicado se o usuário tiver FINANCIAL_EDIT (revalidado no service) — ignorado caso contrário. */
  precoUnitario: z.coerce.number().nonnegative().optional(),
  /** ITENSORDEMSERVICOPROD.DESCRCOMPLEMENT — texto livre, só o cliente preenche. */
  descricaoComplementar: z.string().trim().max(1000).transform(toUppercase).optional(),
});

export const adicionarServicoSchema = z.object({
  servicoCodigo: z.string().trim().min(1),
  quantidade: z.coerce.number().positive().default(1),
  /** Só aplicado se o usuário tiver FINANCIAL_EDIT (revalidado no service) — ignorado caso contrário. */
  valorUnitario: z.coerce.number().nonnegative().optional(),
  descricaoComplementar: z.string().trim().max(1000).transform(toUppercase).optional(),
});

export const atualizarItemSchema = z
  .object({
    quantidade: z.coerce.number().positive().optional(),
    precoUnitario: z.coerce.number().nonnegative().optional(),
    descricaoComplementar: z.string().trim().max(1000).transform(toUppercase).optional(),
  })
  .refine((data) => data.quantidade !== undefined || data.precoUnitario !== undefined || data.descricaoComplementar !== undefined, {
    message: 'Informe quantidade, preço unitário e/ou complemento pra atualizar.',
  });

export const listarOSQuerySchema = z.object({
  status: z.union([z.enum(OS_STATUS_VALUES), z.literal('AGUARDANDO')]).optional(),
  situacaoDocumento: z.coerce.number().int().min(0).max(6).optional(),
  // z.coerce.boolean() usaria JS Boolean(str), que dá `true` até pra "false" (string não-vazia) —
  // query string sempre chega como texto, então precisa comparar o valor, não só a presença.
  incluirFinalizadas: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
  clienteCodigo: z.string().trim().min(1).optional(),
  tecnicoId: z.string().trim().min(1).optional(),
  prioridade: z.enum(OS_PRIORIDADE_VALUES).optional(),
  busca: z.string().trim().min(1).optional(),
  dataInicial: calendarStartSchema.optional(),
  dataFinal: calendarEndSchema.optional(),
  sortBy: z.enum(['numero', 'clienteNome', 'equipamentoDescricao', 'dataAbertura', 'status', 'situacaoDocumento', 'prioridade', 'faturamento']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
