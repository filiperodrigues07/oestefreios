import type { Permission } from '../../types/auth.types.js';

export interface NavItem {
  to: string;
  label: string;
  /** Rótulo curto quando o item aparece na barra inferior estreita. */
  mobileLabel?: string;
  icon:
    | 'home'
    | 'clipboard'
    | 'box'
    | 'user'
    | 'users'
    | 'shield'
    | 'gear'
    | 'building'
    | 'chart'
    | 'truck';
  /** Item só aparece se o usuário tiver ao menos uma dessas permissões. Omitido = sempre visível a quem está logado. */
  anyPermission?: Permission[];
  /** Só o proprietário (super admin) vê este item. */
  superAdminOnly?: boolean;
}

/** IA mínima com telas reais (seção 29 do briefing: "Início | OS | Produtos | Perfil"). */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'home', anyPermission: ['REPORT_VIEW', 'FINANCIAL_VIEW'] },
  {
    to: '/os',
    label: 'Ordem de Serviço',
    mobileLabel: 'OS',
    icon: 'clipboard',
    anyPermission: ['OS_VIEW'],
  },
  { to: '/clientes', label: 'Clientes', icon: 'building', anyPermission: ['OS_VIEW'] },
  { to: '/veiculos', label: 'Veículos', icon: 'truck', anyPermission: ['OS_VIEW'] },
  {
    to: '/produtos',
    label: 'Produtos',
    icon: 'box',
    anyPermission: ['PRODUCT_VIEW', 'SERVICE_VIEW'],
  },
  { to: '/relatorios', label: 'Relatórios', icon: 'chart', anyPermission: ['REPORT_VIEW'] },
  { to: '/usuarios', label: 'Usuários', icon: 'users', anyPermission: ['USER_VIEW'] },
  { to: '/perfil', label: 'Perfil', icon: 'user' },
  {
    to: '/configuracoes',
    label: 'Configurações',
    icon: 'gear',
    anyPermission: ['SYSTEM_SETTINGS'],
  },
  { to: '/proprietario', label: 'Proprietário', icon: 'shield', superAdminOnly: true },
];
