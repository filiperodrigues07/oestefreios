export interface NavItem {
  to: string;
  label: string;
  icon: 'home' | 'clipboard' | 'box' | 'user';
}

/** IA mínima com telas reais (seção 29 do briefing: "Início | OS | Produtos | Perfil"). */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Início', icon: 'home' },
  { to: '/os', label: 'OS', icon: 'clipboard' },
  { to: '/produtos', label: 'Produtos', icon: 'box' },
  { to: '/perfil', label: 'Perfil', icon: 'user' },
];
