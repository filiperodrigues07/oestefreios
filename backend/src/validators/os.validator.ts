import { z } from 'zod';

const OS_STATUS_VALUES = [
  'ABERTA',
  'EM_ANALISE',
  'EM_ANDAMENTO',
  'AGUARDANDO_PECA',
  'AGUARDANDO_CLIENTE',
  'CONCLUIDA',
  'CANCELADA',
] as const;

const OS_PRIORIDADE_VALUES = ['BAIXA', 'NORMAL', 'ALTA', 'URGENTE'] as const;

export const criarOSSchema = z.object({
  clienteCodigo: z.string().trim().min(1, 'Cliente é obrigatório.'),
  equipamentoCodigo: z.string().trim().min(1, 'Equipamento é obrigatório.'),
  problema: z.string().trim().min(1, 'Descreva o problema relatado.'),
  prioridade: z.enum(OS_PRIORIDADE_VALUES).default('NORMAL'),
  responsavelId: z.string().trim().min(1).optional(),
  tecnicoId: z.string().trim().min(1).optional(),
  dataPrevista: z.iso.datetime().optional(),
});

export const atualizarOSSchema = z
  .object({
    diagnostico: z.string().trim().optional(),
    observacoes: z.string().trim().optional(),
    solucao: z.string().trim().optional(),
    prioridade: z.enum(OS_PRIORIDADE_VALUES).optional(),
    responsavelId: z.string().trim().min(1).optional(),
    tecnicoId: z.string().trim().min(1).optional(),
    dataPrevista: z.iso.datetime().optional(),
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

export const adicionarProdutoSchema = z.object({
  produtoCodigo: z.string().trim().min(1),
  quantidade: z.coerce.number().positive().default(1),
});

export const adicionarServicoSchema = z.object({
  servicoCodigo: z.string().trim().min(1),
  quantidade: z.coerce.number().positive().default(1),
});

export const listarOSQuerySchema = z.object({
  status: z.enum(OS_STATUS_VALUES).optional(),
  clienteCodigo: z.string().trim().min(1).optional(),
  tecnicoId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
