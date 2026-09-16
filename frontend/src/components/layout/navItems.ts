import type { Permission } from '../../types/auth.types.js';

export interface NavItem {
  to: string;
  label: string;
  icon: 'home' | 'clipboard' | 'box' | 'user' | 'users' | 'shield' | 'gear' | 'building';
  /** Item só aparece se o usuário tiver ao menos uma dessas permissões. Omitido = sempre visível a quem está logado. */
  anyPermission?: Permission[];
}

/** IA mínima com telas reais (seção 29 do briefing: "Início | OS | Produtos | Perfil"). */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'home', anyPermission: ['REPORT_VIEW', 'FINANCIAL_VIEW'] },
  { to: '/os', label: 'Ordem de Serviço', icon: 'clipboard', anyPermission: ['OS_VIEW'] },
  { to: '/clientes', label: 'Clientes', icon: 'building', anyPermission: ['OS_VIEW'] },
  { to: '/produtos', label: 'Produtos', icon: 'box', anyPermission: ['PRODUCT_VIEW', 'SERVICE_VIEW'] },
  { to: '/auditoria', label: 'Auditoria', icon: 'shield', anyPermission: ['SYSTEM_SETTINGS'] },
  { to: '/usuarios', label: 'Usuários', icon: 'users', anyPermission: ['USER_VIEW'] },
  { to: '/perfil', label: 'Perfil', icon: 'user' },
  { to: '/configuracoes', label: 'Configurações', icon: 'gear', anyPermission: ['SYSTEM_SETTINGS'] },
];
