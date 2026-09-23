import type { Permission } from './auth.types.js';

export interface UserSummaryDTO {
  id: string;
  name: string;
  email: string;
  photoUrl?: string | null;
  isActive: boolean;
  roleId: string;
  roleName: string;
  permissions: Permission[];
  isCustom: boolean;
  mustChangePassword: boolean;
  cherpUsuarioChave: number | null;
  createdAt: string;
}

export interface RoleOptionDTO {
  id: string;
  name: string;
  description: string | null;
  permissions: Permission[];
}

export interface CherpUserOptionDTO {
  chave: number;
  nome: string;
  login?: string;
}

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
