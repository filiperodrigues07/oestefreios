import type { Permission } from './auth.types.js';

export interface UserSummaryDTO {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  roleId: string;
  roleName: string;
  permissions: Permission[];
  isCustom: boolean;
  createdAt: string;
}

export interface RoleOptionDTO {
  id: string;
  name: string;
  description: string | null;
  permissions: Permission[];
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
