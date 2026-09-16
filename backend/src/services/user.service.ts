import { randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { hashPassword } from '../auth/password.js';
import type { RoleOptionDTO, UserSummaryDTO } from '../dto/user.dto.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import { ValidationError } from '../errors/ValidationError.js';
import { passwordResetTokenRepository } from '../repositories/postgres/PasswordResetTokenRepository.js';
import { userRepository, type RoleRow, type UserRow } from '../repositories/postgres/UserRepository.js';
import type { AuthenticatedUser, Permission } from '../types/auth.types.js';
import { logger } from '../utils/logger.js';
import { recordAudit } from './auditLog.service.js';
import { isSmtpConfigured, sendEmail } from './settings.service.js';

export interface RequestContext {
  ip?: string;
  userAgent?: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  roleId: string;
  isActive?: boolean;
  permissions?: Permission[];
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  roleId?: string;
  isActive?: boolean;
  permissions?: Permission[];
}

/** Convite expira em 72h — mais folgado que o reset comum (45min), pois é a primeira senha do usuário. */
const INVITE_TOKEN_TTL_MS = 72 * 60 * 60 * 1000;

function auditUser(event: string, actor: AuthenticatedUser, targetId: string, ctx: RequestContext, changes?: unknown) {
  return recordAudit({
    userId: actor.id,
    userName: actor.name,
    event,
    entityType: 'USER',
    entityId: targetId,
    changes,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
}

async function toSummaryDTO(row: UserRow): Promise<UserSummaryDTO> {
  const [permissions, preset] = await Promise.all([
    userRepository.getUserPermissions(row.id),
    userRepository.getRolePermissionsPreset(row.roleId),
  ]);
  const isCustom = !setsEqual(permissions, preset);
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    isActive: row.isActive,
    roleId: row.roleId,
    roleName: row.roleName,
    permissions,
    isCustom,
    createdAt: row.createdAt.toISOString(),
  };
}

function setsEqual(a: Permission[], b: Permission[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((p) => setB.has(p));
}

export async function listUsers(): Promise<UserSummaryDTO[]> {
  const rows = await userRepository.list();
  return Promise.all(rows.map(toSummaryDTO));
}

export async function listRoles(): Promise<RoleOptionDTO[]> {
  const roles = await userRepository.listRoles();
  return Promise.all(roles.map(async (role: RoleRow) => ({
    id: role.id,
    name: role.name,
    description: role.description,
    permissions: await userRepository.getRolePermissionsPreset(role.id),
  })));
}

export async function getUserById(id: string): Promise<UserSummaryDTO> {
  const row = await userRepository.findRowById(id);
  if (!row) throw new NotFoundError('Usuário não encontrado.', 'USER_NOT_FOUND');
  return toSummaryDTO(row);
}

async function sendInviteEmail(userId: string, name: string, email: string): Promise<void> {
  if (!(await isSmtpConfigured())) {
    logger.warn({ email }, 'Convite de usuário não enviado: SMTP não configurado.');
    return;
  }
  const token = randomBytes(32).toString('hex');

  await passwordResetTokenRepository.create({
    userId,
    token,
    expiresAt: new Date(Date.now() + INVITE_TOKEN_TTL_MS),
  });

  const link = `${env.FRONTEND_URL}/redefinir-senha?token=${token}`;
  try {
    await sendEmail(
      email,
      'Bem-vindo(a) ao Oeste Freios — defina sua senha',
      `<p>Olá, ${name}.</p>
       <p>Uma conta foi criada pra você no Oeste Freios. Clique no link abaixo pra definir sua senha de acesso — ele expira em 72 horas:</p>
       <p><a href="${link}">${link}</a></p>`,
    );
  } catch (err) {
    logger.warn({ err, email }, 'Falha ao enviar e-mail de convite.');
  }
}

export async function createUser(
  input: CreateUserInput,
  actor: AuthenticatedUser,
  ctx: RequestContext,
): Promise<UserSummaryDTO> {
  const existing = await userRepository.findByEmail(input.email);
  if (existing) {
    throw new ValidationError('Já existe um usuário cadastrado com este e-mail.');
  }

  const role = await userRepository.findRoleById(input.roleId);
  if (!role) {
    throw new ValidationError('Perfil selecionado não existe.');
  }

  // Senha temporária aleatória, nunca exposta — o usuário define a própria senha pelo link de convite.
  const temporaryPassword = randomBytes(32).toString('hex');
  const passwordHash = await hashPassword(temporaryPassword);

  const userId = await userRepository.create({
    name: input.name,
    email: input.email,
    passwordHash,
    roleId: input.roleId,
    isActive: input.isActive ?? true,
  });

  const preset = await userRepository.getRolePermissionsPreset(input.roleId);
  await userRepository.setPermissions(userId, input.permissions ?? preset);

  await auditUser('USER_CREATED', actor, userId, ctx, { name: input.name, email: input.email, roleName: role.name });
  await sendInviteEmail(userId, input.name, input.email);

  return getUserById(userId);
}

export async function updateUser(
  id: string,
  input: UpdateUserInput,
  actor: AuthenticatedUser,
  ctx: RequestContext,
): Promise<UserSummaryDTO> {
  const before = await userRepository.findRowById(id);
  if (!before) throw new NotFoundError('Usuário não encontrado.', 'USER_NOT_FOUND');

  if (input.email && input.email !== before.email) {
    const existing = await userRepository.findByEmail(input.email);
    if (existing && existing.id !== id) {
      throw new ValidationError('Já existe um usuário cadastrado com este e-mail.');
    }
  }

  if (input.roleId) {
    const role = await userRepository.findRoleById(input.roleId);
    if (!role) throw new ValidationError('Perfil selecionado não existe.');
  }

  await userRepository.update(id, {
    name: input.name,
    email: input.email,
    roleId: input.roleId,
    isActive: input.isActive,
  });

  if (input.permissions) {
    await userRepository.setPermissions(id, input.permissions);
  }

  await auditUser('USER_UPDATED', actor, id, ctx, { before, after: input });

  return getUserById(id);
}

export async function deleteUser(id: string, actor: AuthenticatedUser, ctx: RequestContext): Promise<void> {
  if (id === actor.id) {
    throw new ValidationError('Não é possível excluir o próprio usuário.');
  }
  const row = await userRepository.findRowById(id);
  if (!row) throw new NotFoundError('Usuário não encontrado.', 'USER_NOT_FOUND');

  await userRepository.delete(id);
  await auditUser('USER_DELETED', actor, id, ctx, { name: row.name, email: row.email });
}

export async function reenviarConvite(id: string, actor: AuthenticatedUser, ctx: RequestContext): Promise<void> {
  const row = await userRepository.findRowById(id);
  if (!row) throw new NotFoundError('Usuário não encontrado.', 'USER_NOT_FOUND');

  await sendInviteEmail(row.id, row.name, row.email);
  await auditUser('USER_INVITE_RESENT', actor, id, ctx);
}
