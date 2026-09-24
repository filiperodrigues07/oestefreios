import { randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { hashPassword } from '../auth/password.js';
import { passwordPolicyErrors } from '../auth/passwordPolicy.js';
import type { RoleOptionDTO, UserSummaryDTO } from '../dto/user.dto.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import { ValidationError } from '../errors/ValidationError.js';
import { passwordResetTokenRepository } from '../repositories/postgres/PasswordResetTokenRepository.js';
import { refreshTokenRepository } from '../repositories/postgres/RefreshTokenRepository.js';
import { userRepository, type RoleRow, type UserRow } from '../repositories/postgres/UserRepository.js';
import { cherpUsuarioRepository } from '../repositories/firebird/CherpUsuarioRepository.firebird.js';
import { getCherpMode } from '../repositories/cherpMode.js';
import type { AuthenticatedUser, Permission } from '../types/auth.types.js';
import { logger } from '../utils/logger.js';
import type { RequestContext } from '../utils/requestContext.js';
import { recordAudit } from './auditLog.service.js';
import { isSmtpConfigured, sendEmail } from './settings.service.js';

export interface CreateUserInput {
  name: string;
  email: string;
  roleId: string;
  isActive?: boolean;
  permissions?: Permission[];
  password?: string;
  cherpUsuarioChave?: number | null;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  roleId?: string;
  isActive?: boolean;
  permissions?: Permission[];
  cherpUsuarioChave?: number | null;
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

/** O proprietário é invisível para os demais: some da lista e das ações (404, não 403). */
function escondidoPara(row: { isSuperAdmin: boolean }, actor?: AuthenticatedUser): boolean {
  return row.isSuperAdmin && !actor?.isSuperAdmin;
}

async function garantirQueRestaProprietario(row: { id: string; isSuperAdmin: boolean }): Promise<void> {
  if (row.isSuperAdmin && (await userRepository.countActiveSuperAdmins(row.id)) === 0) {
    throw new ValidationError('Não é possível remover ou inativar o último proprietário do sistema.');
  }
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
    photoUrl: row.photoUrl,
    isActive: row.isActive,
    roleId: row.roleId,
    roleName: row.roleName,
    permissions,
    isCustom,
    mustChangePassword: row.mustChangePassword,
    cherpUsuarioChave: row.cherpUsuarioChave,
    createdAt: row.createdAt.toISOString(),
  };
}

function setsEqual(a: Permission[], b: Permission[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((p) => setB.has(p));
}

export async function listUsers(actor?: AuthenticatedUser): Promise<UserSummaryDTO[]> {
  const rows = (await userRepository.list()).filter((row) => !escondidoPara(row, actor));
  const [permissionsByUser, permissionsByRole] = await Promise.all([
    userRepository.getPermissionsForUsers(rows.map((row) => row.id)),
    userRepository.getPermissionsForRoles([...new Set(rows.map((row) => row.roleId))]),
  ]);
  return rows.map((row) => {
    const permissions = permissionsByUser.get(row.id) ?? [];
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      photoUrl: row.photoUrl,
      isActive: row.isActive,
      roleId: row.roleId,
      roleName: row.roleName,
      permissions,
      isCustom: !setsEqual(permissions, permissionsByRole.get(row.roleId) ?? []),
      mustChangePassword: row.mustChangePassword,
      cherpUsuarioChave: row.cherpUsuarioChave,
      createdAt: row.createdAt.toISOString(),
    };
  });
}

export async function listRoles(): Promise<RoleOptionDTO[]> {
  const roles = await userRepository.listRoles();
  const permissionsByRole = await userRepository.getPermissionsForRoles(roles.map((role) => role.id));
  return roles.map((role: RoleRow) => ({
    id: role.id,
    name: role.name,
    description: role.description,
    permissions: permissionsByRole.get(role.id) ?? [],
  }));
}

export async function listCherpUsers() {
  if (getCherpMode() !== 'firebird') return [];
  return cherpUsuarioRepository.listarAtivos();
}

export async function getUserById(id: string, actor?: AuthenticatedUser): Promise<UserSummaryDTO> {
  const row = await userRepository.findRowById(id);
  if (!row || escondidoPara(row, actor)) throw new NotFoundError('Usuário não encontrado.', 'USER_NOT_FOUND');
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
  const email = input.email.trim().toLocaleLowerCase('pt-BR');
  const existing = await userRepository.findByEmail(email);
  if (existing) {
    throw new ValidationError('Já existe um usuário cadastrado com este e-mail.');
  }

  if (input.cherpUsuarioChave) {
    const linked = await userRepository.findByCherpUsuarioChave(input.cherpUsuarioChave);
    if (linked) throw new ValidationError('Este usuário do CHERP já está vinculado a outra conta.');
  }
  if (input.password) {
    const [passwordError] = passwordPolicyErrors(input.password, { name: input.name, email });
    if (passwordError) throw new ValidationError(passwordError);
  }

  const role = await userRepository.findRoleById(input.roleId);
  if (!role) {
    throw new ValidationError('Perfil selecionado não existe.');
  }

  // Senha temporária aleatória, nunca exposta — o usuário define a própria senha pelo link de convite.
  const passwordHash = await hashPassword(input.password ?? randomBytes(32).toString('hex'));

  const preset = await userRepository.getRolePermissionsPreset(input.roleId);
  const userId = await userRepository.createWithPermissions({
    name: input.name,
    email,
    passwordHash,
    roleId: input.roleId,
    isActive: input.isActive ?? true,
    mustChangePassword: Boolean(input.password),
    cherpUsuarioChave: input.cherpUsuarioChave,
  }, input.permissions ?? preset);

  await auditUser('USER_CREATED', actor, userId, ctx, { name: input.name, email, roleName: role.name, cherpUsuarioChave: input.cherpUsuarioChave });
  if (!input.password) await sendInviteEmail(userId, input.name, email);

  return getUserById(userId);
}

export async function updateUser(
  id: string,
  input: UpdateUserInput,
  actor: AuthenticatedUser,
  ctx: RequestContext,
): Promise<UserSummaryDTO> {
  const before = await userRepository.findRowById(id);
  if (!before || escondidoPara(before, actor)) throw new NotFoundError('Usuário não encontrado.', 'USER_NOT_FOUND');
  if (input.isActive === false) await garantirQueRestaProprietario(before);

  if (input.email && input.email !== before.email) {
    input.email = input.email.trim().toLocaleLowerCase('pt-BR');
    const existing = await userRepository.findByEmail(input.email);
    if (existing && existing.id !== id) {
      throw new ValidationError('Já existe um usuário cadastrado com este e-mail.');
    }
  }

  if (input.cherpUsuarioChave) {
    const linked = await userRepository.findByCherpUsuarioChave(input.cherpUsuarioChave);
    if (linked && linked.id !== id) throw new ValidationError('Este usuário do CHERP já está vinculado a outra conta.');
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
    cherpUsuarioChave: input.cherpUsuarioChave,
  });

  if (input.permissions) {
    await userRepository.setPermissions(id, input.permissions);
  }

  const securityChanged = input.roleId !== undefined || input.isActive !== undefined || input.permissions !== undefined;
  if (securityChanged) {
    await userRepository.bumpSessionVersion(id);
    await refreshTokenRepository.revokeAllForUser(id);
  }

  await auditUser('USER_UPDATED', actor, id, ctx, { before, after: input });

  return getUserById(id);
}

export async function deleteUser(id: string, actor: AuthenticatedUser, ctx: RequestContext): Promise<void> {
  if (id === actor.id) {
    throw new ValidationError('Não é possível excluir o próprio usuário.');
  }
  const row = await userRepository.findRowById(id);
  if (!row || escondidoPara(row, actor)) throw new NotFoundError('Usuário não encontrado.', 'USER_NOT_FOUND');
  await garantirQueRestaProprietario(row);

  await userRepository.delete(id);
  await auditUser('USER_DELETED', actor, id, ctx, { name: row.name, email: row.email });
}

export async function reenviarConvite(id: string, actor: AuthenticatedUser, ctx: RequestContext): Promise<void> {
  const row = await userRepository.findRowById(id);
  if (!row || escondidoPara(row, actor)) throw new NotFoundError('Usuário não encontrado.', 'USER_NOT_FOUND');

  await sendInviteEmail(row.id, row.name, row.email);
  await auditUser('USER_INVITE_RESENT', actor, id, ctx);
}
