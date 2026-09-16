import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router';
import { getBranding } from '../../api/settings.api.js';
import { getDashboardOperacional } from '../../api/dashboard.api.js';
import { hasPermission, useAuthStore } from '../../store/authStore.js';
import { useSidebarStore } from '../../store/sidebarStore.js';
import { useThemeStore } from '../../store/themeStore.js';
import { Avatar } from '../ui/Avatar.js';
import { Drawer } from '../ui/Drawer.js';
import styles from './AppShell.module.css';
import { Footer } from './Footer.js';
import { NavIcon } from './NavIcon.js';
import { NAV_ITEMS } from './navItems.js';
import { OfflineBanner } from './OfflineBanner.js';
import { SidebarProfile } from './SidebarProfile.js';
import { GlobalSearch } from './GlobalSearch.js';
import clientLogo from '../../../../img/logo-clean.png';

function brandInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'OF';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

/**
 * Shell responsivo: sidebar fixa a partir de 768px, bottom navigation abaixo disso.
 * Os dois lêem a mesma lista de itens (navItems.ts) para não divergir. Itens com
 * `anyPermission` só renderizam se o usuário logado tiver pelo menos uma delas —
 * nunca confiar só nisso pra segurança (o backend já bloqueia via requirePermission),
 * é só pra não oferecer link pra tela que vai dar 403.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const items = NAV_ITEMS.filter((item) => !item.anyPermission || item.anyPermission.some(hasPermission));
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggleSidebar = useSidebarStore((s) => s.toggle);
  const user = useAuthStore((s) => s.user);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationPeriod = useMemo(() => {
    const fim = new Date(); fim.setHours(23, 59, 59, 999);
    const inicio = new Date(fim); inicio.setDate(inicio.getDate() - 29); inicio.setHours(0, 0, 0, 0);
    return { inicio, fim, granularidade: 'diario' as const };
  }, []);
  const canViewDashboard = hasPermission('REPORT_VIEW');
  const { data: notificationData } = useQuery({ queryKey: ['header-notifications'], queryFn: () => getDashboardOperacional(notificationPeriod), enabled: canViewDashboard, staleTime: 30_000 });

  // Nome/logo do cliente (Configurações > Geral) — qualquer usuário autenticado pode ler.
  const { data: branding } = useQuery({ queryKey: ['branding'], queryFn: getBranding, staleTime: 5 * 60_000 });

  // "Perfil" já vira o bloco de baixo no desktop (SidebarProfile) — evita duplicar na nav do meio.
  // No mobile (bottom nav) continua aparecendo, é o único jeito de chegar lá por lá.
  const sidebarNavItems = items.filter((item) => item.to !== '/perfil');
  const navSections = [
    { label: 'Visão geral', items: sidebarNavItems.filter((item) => item.to === '/') },
    { label: 'Operação', items: sidebarNavItems.filter((item) => ['/os', '/clientes', '/produtos'].includes(item.to)) },
    { label: 'Sistema', items: sidebarNavItems.filter((item) => ['/auditoria', '/usuarios', '/configuracoes'].includes(item.to)) },
  ].filter((section) => section.items.length > 0);

  return (
    <div className={styles.shell}>
      <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}>
        <button
          type="button"
          className={styles.collapseToggle}
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expandir menu' : 'Reduzir menu'}
          title={collapsed ? 'Expandir menu' : 'Reduzir menu'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ transform: collapsed ? 'rotate(180deg)' : undefined }}>
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className={styles.brand}>
          {!collapsed && (
            <img src={branding?.logoUrl || clientLogo} alt={branding?.nomeEmpresa || 'Oeste Freios'} className={styles.brandLogo} />
          )}
          {collapsed && <span className={styles.brandText}>{brandInitials(branding?.nomeEmpresa || 'Oeste Freios')}</span>}
        </div>

        <nav className={styles.sidebarNav} aria-label="Navegação principal">
          {navSections.map((section) => (
            <div key={section.label} className={styles.navGroup}>
              {!collapsed && <span className={styles.navLabel}>{section.label}</span>}
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `${styles.sidebarItem} ${isActive ? styles.sidebarItemActive : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <NavIcon name={item.icon} />
                  {!collapsed && item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          {!collapsed && <div className={styles.promoCard}><strong>Manter sua<br />Oficina em Movimento</strong><span>Gestão simples,<br />resultados reais.</span><b aria-hidden="true">⚙</b></div>}
          <SidebarProfile collapsed={collapsed} />
        </div>

      </aside>

      <main className={styles.main}>
        <header className={styles.desktopHeader}>
          <div className={styles.desktopSearch}><GlobalSearch /></div>
          <div className={styles.headerActions}>
            <div className={styles.notificationWrapper}>
              <button type="button" className={styles.headerIcon} title="Notificações" aria-label="Notificações" onClick={() => setNotificationsOpen((open) => !open)}><span aria-hidden="true">♧</span>{notificationData?.atencao.length ? <i /> : null}</button>
              {notificationsOpen && <div className={styles.notificationMenu}><strong>Notificações</strong>{notificationData?.atencao.length ? notificationData.atencao.slice(0, 3).map((os) => <button key={os.id} onClick={() => { setNotificationsOpen(false); window.location.assign(`/os/${os.id}`); }}><b>OS #{String(os.numero).padStart(6, '0')}</b><span>{os.prioridade === 'URGENTE' || os.prioridade === 'ALTA' ? 'Prioridade requer atenção' : `Aguardando há ${os.dias} dias`}</span></button>) : <p>Sem pendências operacionais.</p>}</div>}
            </div>
            <button type="button" className={styles.headerIcon} onClick={toggleTheme} title={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'} aria-label="Alternar tema">{theme === 'dark' ? '☼' : '☾'}</button>
            <NavLink to="/perfil" className={styles.desktopProfile} aria-label="Abrir perfil">
              <Avatar name={user?.name ?? 'Usuário'} photoUrl={user?.photoUrl ?? undefined} size={34} />
              <span className={styles.desktopProfileCopy}>
                <strong>{user?.name ?? 'Usuário'}</strong>
                <small>{user?.roleName ?? 'Conta'}</small>
              </span>
            </NavLink>
          </div>
        </header>
        <header className={styles.mobileHeader}>
          <button
            type="button"
            className={styles.mobileMenuButton}
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menu de navegação"
            aria-expanded={mobileMenuOpen}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <span className={styles.mobileSection}>Oeste Freios</span>
          <NavLink to="/perfil" className={styles.mobileProfile} aria-label="Abrir perfil">
            <Avatar name={user?.name ?? 'Usuário'} photoUrl={user?.photoUrl ?? undefined} size={32} />
          </NavLink>
        </header>
        <OfflineBanner />
        {children}
        <div className={styles.mainFooter}>
          <Footer />
        </div>
      </main>

      <nav className={styles.bottomNav} aria-label="Navegação principal">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `${styles.bottomNavItem} ${isActive ? styles.bottomNavItemActive : ''}`}
          >
            <NavIcon name={item.icon} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <Drawer open={mobileMenuOpen} title="Navegação" onClose={() => setMobileMenuOpen(false)}>
        <nav className={styles.mobileNav} aria-label="Navegação principal">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => `${styles.mobileNavItem} ${isActive ? styles.mobileNavItemActive : ''}`}
            >
              <NavIcon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <SidebarProfile collapsed={false} />
      </Drawer>
    </div>
  );
}
