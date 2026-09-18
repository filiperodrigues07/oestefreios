import { z } from 'zod';

/** Schema de busca genérico reaproveitado por produto/serviço/cliente/equipamento. */
export const searchQuerySchema = z.object({
  codigo: z.string().trim().min(1).optional(),
  descricao: z.string().trim().min(1).optional(),
  /** Só usado por equipamentos: filtra pelo cliente já selecionado no fluxo de criação de OS (seção 8). */
  clienteCodigo: z.string().trim().min(1).optional(),
  /** Só usado por clientes (Fase A3). */
  tipoPessoa: z.enum(['PF', 'PJ']).optional(),
  uf: z.string().trim().length(2).optional(),
  /** Busca livre em vários campos de uma vez — clientes, produtos e serviços. */
  busca: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  /** Usado pela tela de catálogo (Fase 6) e por clientes — ordenação estável para paginação previsível. */
  sortBy: z.enum(['codigo', 'descricao', 'nome', 'documento', 'telefone', 'cidade', 'categoria', 'tipo']).default('descricao'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const codigoParamSchema = z.object({
  codigo: z.string().trim().min(1),
});
