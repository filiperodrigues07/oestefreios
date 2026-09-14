/**
 * Espelha backend/src/types/auth.types.ts. Duplicado porque o monorepo tem
 * só 2 workspaces (backend/frontend), sem workspace `shared/` — decisão do
 * usuário, não reaberta. Ao adicionar/remover uma permissão, atualize os dois arquivos.
 */
export const PERMISSIONS = [
  'OS_VIEW',
  'OS_CREATE',
  'OS_EDIT',
  'OS_DELETE',
  'OS_CHANGE_STATUS',

  'PRODUCT_VIEW',
  'PRODUCT_SEARCH',
  'PRODUCT_ADD_TO_OS',

  'SERVICE_VIEW',
  'SERVICE_SEARCH',
  'SERVICE_ADD_TO_OS',

  'FINANCIAL_VIEW',
  'FINANCIAL_EDIT',

  'USER_VIEW',
  'USER_CREATE',
  'USER_EDIT',
  'USER_DELETE',

  'REPORT_VIEW',
  'SYSTEM_SETTINGS',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  permissions: Permission[];
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}
