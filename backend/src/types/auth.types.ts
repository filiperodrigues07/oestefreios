/**
 * Lista fechada de permissões do sistema. Fonte de verdade única — o seed do
 * Postgres e o RBAC do frontend devem espelhar exatamente estes códigos.
 */
export const PERMISSIONS = [
  'OS_VIEW',
  'OS_CREATE',
  'OS_EDIT',
  'OS_DELETE',
  'OS_CHANGE_STATUS',

  'CLIENT_DELETE',
  'VEHICLE_DELETE',

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

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  permissions: Permission[];
  sessionVersion?: number;
  mustChangePassword?: boolean;
  cherpUsuarioChave?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  permissions: Permission[];
  mustChangePassword: boolean;
  cherpUsuarioChave?: number;
}
