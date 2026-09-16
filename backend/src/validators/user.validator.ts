import { z } from 'zod';
import { PERMISSIONS } from '../types/auth.types.js';

export const userIdParamSchema = z.object({
  id: z.uuid('ID de usuário inválido.'),
});

const permissionsSchema = z.array(z.enum(PERMISSIONS)).optional();

export const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório.'),
  email: z.email('E-mail inválido.'),
  roleId: z.uuid('Selecione um perfil.'),
  isActive: z.boolean().default(true),
  /** Se omitido, usa o preset do papel escolhido. */
  permissions: permissionsSchema,
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório.').optional(),
  email: z.email('E-mail inválido.').optional(),
  roleId: z.uuid('Selecione um perfil.').optional(),
  isActive: z.boolean().optional(),
  permissions: permissionsSchema,
});
