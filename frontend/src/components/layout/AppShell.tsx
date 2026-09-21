import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';
import { getBranding } from '../../api/settings.api.js';
import { getDashboardOperacional } from '../../api/dashboard.api.js';
import { hasPermission, useAuthStore } from '../../store/authStore.js';
import { useSidebarStore } from '../../store/sidebarStore.js';
import { useThemeStore } from '../../store/themeStore.js';
import { Avatar } from '../ui/Avatar.js';
import { Drawer } from '../ui/Drawer.js';
import styles from './AppShell.module.css';
import { Footer } from './Footer.js';
import { InstallBanner } from './InstallBanner.js';
import { NavIcon } from './NavIcon.js';
import { NAV_ITEMS } from './navItems.js';
import { OfflineBanner } from './OfflineBanner.js';
import { ProfileModal } from './ProfileModal.js';
import { SidebarProfile } from './SidebarProfile.js';
import { GlobalSearch } from './GlobalSearch.js';
import clientLogo from '../../../../img/logo-clean.png';
import type { DashboardAtencaoDTO } from '../../types/dashboard.types.js';

function tituloDaPagina(pathname: string): string {
  if (pathname === '/') return 'Dashboard';
  if (pathname === '/os') return 'Ordens de Serviço';
  if (pathname === '/os/nova') return 'Nova Ordem de Serviço';
  if (pathname.startsWith('/os/')) return 'Ordem de Serviço';
  if (pathname === '/clientes') return 'Clientes';
  if (pathname === '/veiculos') return 'Veículos';
  if (pathname === '/clientes/novo') return 'Novo Cliente';
  if (pathname.startsWith('/clientes/')) return 'Editar Cliente';
  if (pathname === '/produtos') return 'Produtos e Serviços';
  if (pathname === '/relatorios') return 'Relatórios';
  if (pathname === '/auditoria') return 'Auditoria';
  if (pathname === '/usuarios') return 'Usuários';
  if (pathname === '/configuracoes') return 'Configurações';
  return 'Oeste Freios';
}

function chaveNotificacao(os: DashboardAtencaoDTO): string {
  return `${os.id}:${os.status}:${os.prioridade}:${os.dias}`;
}

function descricaoNotificacao(os: DashboardAtencaoDTO): string {
  if (os.prioridade === 'URGENTE') return 'Prioridade urgente: precisa de ação imediata.';
  if (os.prioridade === 'ALTA') return 'Prioridade alta: acompanhe esta OS.';
  if (os.status === 'AGUARDANDO_PECA')
    return `Aguardando peça há ${os.dias} ${os.dias === 1 ? 'dia' : 'dias'}.`;
  if (os.status === 'AGUARDANDO_CLIENTE')
    return `Aguardando retorno do cliente há ${os.dias} ${os.dias === 1 ? 'dia' : 'dias'}.`;
  return `OS aberta há ${os.dias} ${os.dias === 1 ? 'dia' : 'dias'}.`;
}

/**
 * Shell responsivo: sidebar fixa a partir de 768px, bottom navigation abaixo disso.
 * Os dois lêem a mesma lista de itens (navItems.ts) para não divergir. Itens com
 * `anyPermission` só renderizam se o usuário logado tiver pelo menos uma delas —
 * nunca confiar só nisso pra segurança (o backend já bloqueia via requirePermission),
 * é só pra não oferecer link pra tela que vai dar 403.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const tituloPagina = tituloDaPagina(location.pathname);
  const items = NAV_ITEMS.filter(
    (item) => !item.anyPermission || item.anyPermission.some(hasPermission),
  );
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggleSidebar = useSidebarStore((s) => s.toggle);
  const user = useAuthStore((s) => s.user);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificacoesLidas, setNotificacoesLidas] = useState<string[]>([]);
  const notificationWrapperRef = useRef<HTMLDivElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const notificationPeriod = useMemo(() => {
    const fim = new Date();
    fim.setHours(23, 59, 59, 999);
    const inicio = new Date(fim);
    inicio.setDate(inicio.getDate() - 29);
    inicio.setHours(0, 0, 0, 0);
    return { inicio, fim, granularidade: 'diario' as const };
  }, []);
  const canViewDashboard = hasPermission('REPORT_VIEW');
  const { data: notificationData } = useQuery({
    queryKey: ['header-notifications'],
    queryFn: () => getDashboardOperacional(notificationPeriod),
    enabled: canViewDashboard,
    staleTime: 30_000,
  });
  const notificacoes = useMemo(
    () =>
      (notificationData?.atencao ?? []).filter(
        (os) => !notificacoesLidas.includes(chaveNotificacao(os)),
      ),
    [notificationData?.atencao, notificacoesLidas],
  );

  // Nome/logo/cor do cliente (Configurações > Geral) — qualquer usuário autenticado pode ler.
  const { data: branding } = useQuery({
    queryKey: ['branding'],
    queryFn: getBranding,
    staleTime: 5 * 60_000,
  });

  // Aplica a cor de destaque salva em Configurações > Geral (ou no atalho do modal de perfil) no app inteiro.
  useEffect(() => {
    if (branding?.corDestaque) {
      document.documentElement.style.setProperty('--color-primary', branding.corDestaque);
    }
  }, [branding?.corDestaque]);

  useEffect(() => {
    document.title = `${tituloPagina} | ${branding?.nomeEmpresa || 'Oeste Freios'}`;
  }, [tituloPagina, branding?.nomeEmpresa]);

  useEffect(() => {
    if (!user?.id) return;
    try {
      const value = localStorage.getItem(`notifications-read:${user.id}`);
      setNotificacoesLidas(value ? JSON.parse(value) : []);
    } catch {
      setNotificacoesLidas([]);
    }
  }, [user?.id]);

  useEffect(() => {
    function fecharAoClicarFora(event: PointerEvent) {
      if (
        notificationWrapperRef.current &&
        !notificationWrapperRef.current.contains(event.target as Node)
      )
        setNotificationsOpen(false);
    }
    function fecharComEsc(event: KeyboardEvent) {
      if (event.key === 'Escape') setNotificationsOpen(false);
    }
    document.addEventListener('pointerdown', fecharAoClicarFora);
    document.addEventListener('keydown', fecharComEsc);
    return () => {
      document.removeEventListener('pointerdown', fecharAoClicarFora);
      document.removeEventListener('keydown', fecharComEsc);
    };
  }, []);

  function marcarTodasComoLidas() {
    if (!user?.id) return;
    const proximas = [...new Set([...notificacoesLidas, ...notificacoes.map(chaveNotificacao)])];
    setNotificacoesLidas(proximas);
    localStorage.setItem(`notifications-read:${user.id}`, JSON.stringify(proximas));
  }

  // "Perfil" já vira o bloco de baixo no desktop (SidebarProfile) — evita duplicar na nav do meio.
  // No mobile (bottom nav) continua aparecendo, é o único jeito de chegar lá por lá.
  const sidebarNavItems = items.filter((item) => item.to !== '/perfil');
  // Bottom nav só cabe uns 5 itens sem virar bagunça (regra geral de bottom nav mobile) — os 3
  // primeiros da IA (Dashboard/OS/Clientes pra maioria dos perfis) + Buscar + Menu (resto fica na gaveta).
  const quickNavItems = sidebarNavItems.slice(0, 3);
  const navSections = [
    { label: 'Visão geral', items: sidebarNavItems.filter((item) => item.to === '/') },
    {
      label: 'Operação',
      items: sidebarNavItems.filter((item) =>
        ['/os', '/clientes', '/veiculos', '/produtos', '/relatorios'].includes(item.to),
      ),
    },
    {
      label: 'Sistema',
      items: sidebarNavItems.filter((item) =>
        ['/auditoria', '/usuarios', '/configuracoes'].includes(item.to),
      ),
    },
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
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            style={{ transform: collapsed ? 'rotate(180deg)' : undefined }}
          >
            <path
              d="M15 6l-6 6 6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div className={styles.brand}>
          <img
            src={branding?.logoUrl || clientLogo}
            alt={branding?.nomeEmpresa || 'Oeste Freios'}
            className={`${styles.brandLogo} ${collapsed ? styles.brandLogoCollapsed : ''}`}
          />
          {!collapsed && <span className={styles.brandCaption}>Mecânica Oeste Freios</span>}
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
                  className={({ isActive }) =>
                    `${styles.sidebarItem} ${isActive ? styles.sidebarItemActive : ''}`
                  }
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
          <SidebarProfile collapsed={collapsed} onOpenProfile={() => setProfileOpen(true)} />
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.desktopHeader}>
          <div className={styles.desktopSearch}>
            <GlobalSearch />
          </div>
          <div className={styles.headerActions}>
            <div className={styles.notificationWrapper} ref={notificationWrapperRef}>
              <button
                type="button"
                className={styles.headerIcon}
                title="Notificações"
                aria-label="Notificações"
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {notificacoes.length ? <i /> : null}
              </button>
              {notificationsOpen && (
                <div className={styles.notificationMenu} role="dialog" aria-label="Notificações">
                  <div className={styles.notificationMenuHeader}>
                    <div>
                      <strong>Notificações</strong>
                      <span>OS que exigem acompanhamento</span>
                    </div>
                    {notificacoes.length > 0 && (
                      <button
                        type="button"
                        className={styles.markAllRead}
                        onClick={marcarTodasComoLidas}
                      >
                        Marcar todas como lidas
                      </button>
                    )}
                  </div>
                  {notificacoes.length ? (
                    notificacoes.map((os) => (
                      <button
                        key={chaveNotificacao(os)}
                        className={styles.notificationItem}
                        onClick={() => {
                          setNotificationsOpen(false);
                          window.location.assign(`/os/${os.id}`);
                        }}
                      >
                        <b>
                          OS #{String(os.numero).padStart(6, '0')}{' '}
                          {os.clienteNome ? `· ${os.clienteNome}` : ''}
                        </b>
                        <span>{descricaoNotificacao(os)}</span>
                      </button>
                    ))
                  ) : (
                    <p className={styles.notificationEmpty}>
                      Nenhuma OS precisa de atenção no momento.
                    </p>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              className={styles.headerIcon}
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
              aria-label="Alternar tema"
            >
              {theme === 'dark' ? '☼' : '☾'}
            </button>
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
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <span className={styles.mobileSection}>{tituloPagina}</span>
          <button
            type="button"
            className={styles.mobileProfile}
            aria-label="Abrir perfil"
            onClick={() => setProfileOpen(true)}
          >
            <Avatar
              name={user?.name ?? 'Usuário'}
              photoUrl={user?.photoUrl ?? undefined}
              size={32}
            />
          </button>
        </header>
        <OfflineBanner />
        <InstallBanner />
        {children}
        <div className={styles.mainFooter}>
          <Footer />
        </div>
      </main>

      <nav className={styles.bottomNav} aria-label="Navegação principal">
        {quickNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `${styles.bottomNavItem} ${isActive ? styles.bottomNavItemActive : ''}`
            }
          >
            <NavIcon name={item.icon} />
            <span>{item.mobileLabel ?? item.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={styles.bottomNavItem}
          onClick={() => setMobileSearchOpen(true)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="m20 20-3.5-3.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          <span>Buscar</span>
        </button>
        <button
          type="button"
          className={styles.bottomNavItem}
          onClick={() => setMobileMenuOpen(true)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 7h16M4 12h16M4 17h16"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          <span>Menu</span>
        </button>
      </nav>
      {mobileSearchOpen && (
        <div
          className={styles.mobileSearchOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Buscar"
        >
          <div className={styles.mobileSearchHeader}>
            <span>Buscar</span>
            <button
              type="button"
              onClick={() => setMobileSearchOpen(false)}
              aria-label="Fechar busca"
            >
              ✕
            </button>
          </div>
          <div className={styles.mobileSearchBody}>
            <GlobalSearch onNavigate={() => setMobileSearchOpen(false)} />
          </div>
        </div>
      )}
      <Drawer open={mobileMenuOpen} title="" side="left" onClose={() => setMobileMenuOpen(false)}>
        <div className={styles.mobileBrand}>
          <img
            src={branding?.logoUrl || clientLogo}
            alt={branding?.nomeEmpresa || 'Oeste Freios'}
          />
          <div>
            <strong>{branding?.nomeEmpresa || 'Oeste Freios'}</strong>
            <span>Controle de ordens de serviço</span>
          </div>
        </div>
        <nav className={styles.mobileNav} aria-label="Navegação principal">
          {navSections.map((section) => (
            <div key={section.label} className={styles.mobileNavGroup}>
              <span className={styles.mobileNavLabel}>{section.label}</span>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `${styles.mobileNavItem} ${isActive ? styles.mobileNavItemActive : ''}`
                  }
                >
                  <NavIcon name={item.icon} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <SidebarProfile
          collapsed={false}
          onOpenProfile={() => {
            setMobileMenuOpen(false);
            setProfileOpen(true);
          }}
        />
      </Drawer>
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}
