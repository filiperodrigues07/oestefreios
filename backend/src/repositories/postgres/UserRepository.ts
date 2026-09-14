import { eq } from 'drizzle-orm';
import { db } from '../../database/postgres/client.js';
import { permissions, rolePermissions, roles, users } from '../../database/postgres/schema.js';
import type { Permission } from '../../types/auth.types.js';

export interface UserWithRole {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
  roleId: string;
  roleName: string;
  permissions: Permission[];
}

export class UserRepository {
  async findByEmail(email: string): Promise<UserWithRole | null> {
    const [row] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        passwordHash: users.passwordHash,
        isActive: users.isActive,
        roleId: roles.id,
        roleName: roles.name,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.email, email));

    if (!row) return null;

    const perms = await this.getRolePermissions(row.roleId);
    return { ...row, permissions: perms };
  }

  async findById(id: string): Promise<UserWithRole | null> {
    const [row] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        passwordHash: users.passwordHash,
        isActive: users.isActive,
        roleId: roles.id,
        roleName: roles.name,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, id));

    if (!row) return null;

    const perms = await this.getRolePermissions(row.roleId);
    return { ...row, permissions: perms };
  }

  private async getRolePermissions(roleId: string): Promise<Permission[]> {
    const rows = await db
      .select({ code: permissions.code })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId));
    return rows.map((r) => r.code as Permission);
  }
}

export const userRepository = new UserRepository();
