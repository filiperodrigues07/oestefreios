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
  photoUrl: string | null;
  roleId: string;
  roleName: string;
  permissions: Permission[];
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

/** Rótulo amigável de cada permissão — só usado na matriz de Usuários e Permissões (Fase G). */
export const PERMISSION_LABELS: Record<Permission, string> = {
  OS_VIEW: 'Visualizar OS',
  OS_CREATE: 'Criar OS',
  OS_EDIT: 'Editar OS',
  OS_DELETE: 'Excluir OS',
  OS_CHANGE_STATUS: 'Alterar status da OS',
  PRODUCT_VIEW: 'Visualizar produtos',
  PRODUCT_SEARCH: 'Buscar produtos',
  PRODUCT_ADD_TO_OS: 'Adicionar produtos à OS',
  SERVICE_VIEW: 'Visualizar serviços',
  SERVICE_SEARCH: 'Buscar serviços',
  SERVICE_ADD_TO_OS: 'Adicionar serviços à OS',
  FINANCIAL_VIEW: 'Ver valores financeiros',
  FINANCIAL_EDIT: 'Editar valores financeiros',
  USER_VIEW: 'Visualizar usuários',
  USER_CREATE: 'Criar usuários',
  USER_EDIT: 'Editar usuários',
  USER_DELETE: 'Excluir usuários',
  REPORT_VIEW: 'Ver dashboard/relatórios',
  SYSTEM_SETTINGS: 'Configurações do sistema',
};

/** Agrupamento por categoria pra matriz de permissões (item 5 da rodada de melhorias). */
export const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  { label: 'Ordens de Serviço', permissions: ['OS_VIEW', 'OS_CREATE', 'OS_EDIT', 'OS_DELETE', 'OS_CHANGE_STATUS'] },
  { label: 'Produtos', permissions: ['PRODUCT_VIEW', 'PRODUCT_SEARCH', 'PRODUCT_ADD_TO_OS'] },
  { label: 'Serviços', permissions: ['SERVICE_VIEW', 'SERVICE_SEARCH', 'SERVICE_ADD_TO_OS'] },
  { label: 'Financeiro', permissions: ['FINANCIAL_VIEW', 'FINANCIAL_EDIT'] },
  { label: 'Usuários', permissions: ['USER_VIEW', 'USER_CREATE', 'USER_EDIT', 'USER_DELETE'] },
  { label: 'Relatórios e Sistema', permissions: ['REPORT_VIEW', 'SYSTEM_SETTINGS'] },
];
