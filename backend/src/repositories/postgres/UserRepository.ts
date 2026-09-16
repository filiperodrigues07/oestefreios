import { eq } from 'drizzle-orm';
import { db } from '../../database/postgres/client.js';
import { permissions, rolePermissions, roles, userPermissions, users } from '../../database/postgres/schema.js';
import type { Permission } from '../../types/auth.types.js';

export interface UserWithRole {
  id: string;
  name: string;
  email: string;
  photoUrl: string | null;
  passwordHash: string;
  isActive: boolean;
  roleId: string;
  roleName: string;
  permissions: Permission[];
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  photoUrl: string | null;
  isActive: boolean;
  roleId: string;
  roleName: string;
  createdAt: Date;
}

export interface RoleRow {
  id: string;
  name: string;
  description: string | null;
}

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  roleId: string;
  isActive: boolean;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  photoUrl?: string | null;
  roleId?: string;
  isActive?: boolean;
}

const USER_ROW_SELECT = {
  id: users.id,
  name: users.name,
  email: users.email,
  photoUrl: users.photoUrl,
  isActive: users.isActive,
  roleId: roles.id,
  roleName: roles.name,
  createdAt: users.createdAt,
};

export class UserRepository {
  async findByEmail(email: string): Promise<UserWithRole | null> {
    const [row] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        photoUrl: users.photoUrl,
        passwordHash: users.passwordHash,
        isActive: users.isActive,
        roleId: roles.id,
        roleName: roles.name,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.email, email));

    if (!row) return null;

    const perms = await this.getUserPermissions(row.id);
    return { ...row, permissions: perms };
  }

  async findById(id: string): Promise<UserWithRole | null> {
    const [row] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        photoUrl: users.photoUrl,
        passwordHash: users.passwordHash,
        isActive: users.isActive,
        roleId: roles.id,
        roleName: roles.name,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, id));

    if (!row) return null;

    const perms = await this.getUserPermissions(row.id);
    return { ...row, permissions: perms };
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async list(): Promise<UserRow[]> {
    return db.select(USER_ROW_SELECT).from(users).innerJoin(roles, eq(users.roleId, roles.id)).orderBy(users.name);
  }

  async findRowById(id: string): Promise<UserRow | null> {
    const [row] = await db
      .select(USER_ROW_SELECT)
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, id));
    return row ?? null;
  }

  async listRoles(): Promise<RoleRow[]> {
    return db.select({ id: roles.id, name: roles.name, description: roles.description }).from(roles).orderBy(roles.name);
  }

  async findRoleById(id: string): Promise<RoleRow | null> {
    const [row] = await db.select({ id: roles.id, name: roles.name, description: roles.description }).from(roles).where(eq(roles.id, id));
    return row ?? null;
  }

  /** Permissões efetivas do usuário (fonte de verdade a partir da Fase G) — não herda mais 100% do papel. */
  async getUserPermissions(userId: string): Promise<Permission[]> {
    const rows = await db
      .select({ code: permissions.code })
      .from(userPermissions)
      .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
      .where(eq(userPermissions.userId, userId));
    return rows.map((r) => r.code as Permission);
  }

  /** Preset do papel — usado só pra pré-marcar a matriz no formulário e detectar customização. */
  async getRolePermissionsPreset(roleId: string): Promise<Permission[]> {
    const rows = await db
      .select({ code: permissions.code })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId));
    return rows.map((r) => r.code as Permission);
  }

  async create(data: CreateUserData): Promise<string> {
    const [row] = await db
      .insert(users)
      .values({
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        roleId: data.roleId,
        isActive: data.isActive,
      })
      .returning({ id: users.id });
    return row!.id;
  }

  async update(id: string, data: UpdateUserData): Promise<void> {
    await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, id));
  }

  async delete(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  /** Substitui o conjunto de permissões efetivas do usuário pelo informado. */
  async setPermissions(userId: string, permissionCodes: Permission[]): Promise<void> {
    const permissionRows = await db.select({ id: permissions.id, code: permissions.code }).from(permissions);
    const idByCode = new Map(permissionRows.map((p) => [p.code as Permission, p.id]));

    await db.transaction(async (tx) => {
      await tx.delete(userPermissions).where(eq(userPermissions.userId, userId));
      const values = permissionCodes
        .map((code) => idByCode.get(code))
        .filter((id): id is string => Boolean(id))
        .map((permissionId) => ({ userId, permissionId }));
      if (values.length > 0) {
        await tx.insert(userPermissions).values(values);
      }
    });
  }
}

export const userRepository = new UserRepository();
