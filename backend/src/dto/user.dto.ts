import type { Permission } from '../types/auth.types.js';

export interface UserSummaryDTO {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  roleId: string;
  roleName: string;
  permissions: Permission[];
  /** true quando `permissions` diverge do preset atual do papel — sinaliza customização na UI. */
  isCustom: boolean;
  mustChangePassword: boolean;
  cherpUsuarioChave: number | null;
  createdAt: string;
}

export interface RoleOptionDTO {
  id: string;
  name: string;
  description: string | null;
  /** Preset de permissões do papel — usado pra pré-marcar a matriz e detectar customização. */
  permissions: Permission[];
}
