import { z } from 'zod';
import { PERMISSIONS } from '../types/auth.types.js';
import { securePasswordSchema } from './auth.validator.js';

export const userIdParamSchema = z.object({
  id: z.uuid('ID de usuário inválido.'),
});

const permissionsSchema = z.array(z.enum(PERMISSIONS)).optional();
const osStatusFixoSchema = z.number().int().min(0).max(6).nullable().optional();
const osSituacaoAtendimentoFixaSchema = z.enum(['000001', '000002', '000003', '000004', '000005', '000006']).nullable().optional();

export const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório.'),
  email: z.email('E-mail inválido.'),
  roleId: z.uuid('Selecione um perfil.'),
  isActive: z.boolean().default(true),
  /** Se omitido, usa o preset do papel escolhido. */
  permissions: permissionsSchema,
  password: securePasswordSchema.optional(),
  cherpUsuarioChave: z.number().int().positive().nullable().optional(),
  osStatusFixo: osStatusFixoSchema,
  osSituacaoAtendimentoFixa: osSituacaoAtendimentoFixaSchema,
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório.').optional(),
  email: z.email('E-mail inválido.').optional(),
  roleId: z.uuid('Selecione um perfil.').optional(),
  isActive: z.boolean().optional(),
  permissions: permissionsSchema,
  cherpUsuarioChave: z.number().int().positive().nullable().optional(),
  osStatusFixo: osStatusFixoSchema,
  osSituacaoAtendimentoFixa: osSituacaoAtendimentoFixaSchema,
});
