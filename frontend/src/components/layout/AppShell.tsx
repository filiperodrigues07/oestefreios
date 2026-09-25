import { useIsMutating, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';
import { prefetchRoute } from '../../routes/prefetch.js';
import { getBranding } from '../../api/settings.api.js';
import { getDashboardOperacional } from '../../api/dashboard.api.js';
import { calendarDateValue } from '../../utils/calendarDate.js';
import { useMobileGestures } from '../../hooks/useMobileGestures.js';
import { PageRefreshProvider } from '../../hooks/usePageRefresh.js';
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
import { SubscriptionBanner } from './SubscriptionBanner.js';
import { ProfileModal } from './ProfileModal.js';
import { SidebarProfile } from './SidebarProfile.js';
import { GlobalSearch } from './GlobalSearch.js';
import clientLogo from '../../../../img/logo-clean.webp';
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
  if (pathname === '/proprietario') return 'Painel do proprietário';
  return 'Oeste Freios';
}

function chaveNotificacao(os: DashboardAtencaoDTO): string {
  return `${os.id}:${os.status}:${os.prioridade}:${os.dias}`;
}

function lerNotificacoesLidas(userId: string): string[] {
  try {
    const value = localStorage.getItem(`notifications-read:${userId}`);
    const parsed: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
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
  const ehProprietario = useAuthStore((s) => s.user?.isSuperAdmin ?? false);
  const items = NAV_ITEMS.filter(
    (item) => (!item.superAdminOnly || ehProprietario) && (!item.anyPermission || item.anyPermission.some(hasPermission)),
  );
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggleSidebar = useSidebarStore((s) => s.toggle);
  const user = useAuthStore((s) => s.user);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readState, setReadState] = useState<{ userId: string; values: string[] } | null>(null);
  const currentUserId = user?.id;
  const notificacoesLidas = useMemo(() => {
    if (!currentUserId) return [];
    return readState?.userId === currentUserId ? readState.values : lerNotificacoesLidas(currentUserId);
  }, [currentUserId, readState]);
  const notificationWrapperRef = useRef<HTMLDivElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const queryClient = useQueryClient();
  const pendingMutations = useIsMutating();
  const pageRefreshRef = useRef<(() => Promise<unknown>) | null>(null);
  const registerPageRefresh = useCallback((handler: (() => Promise<unknown>) | null) => {
    pageRefreshRef.current = handler;
  }, []);
  const refreshCurrentPage = useCallback(async () => {
    if (pageRefreshRef.current) await pageRefreshRef.current();
    else await queryClient.refetchQueries({ type: 'active' }, { throwOnError: true });
  }, [queryClient]);
  const openMobileMenu = useCallback(() => setMobileMenuOpen(true), [setMobileMenuOpen]);
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), [setMobileMenuOpen]);
  const refreshEnabled = !mobileSearchOpen && !profileOpen && pendingMutations === 0
    && location.pathname !== '/os/nova'
    && location.pathname !== '/clientes/novo'
    && !/^\/clientes\/[^/]+\/editar$/.test(location.pathname)
    && location.pathname !== '/configuracoes';
  const pullState = useMobileGestures({
    menuOpen: mobileMenuOpen,
    refreshEnabled,
    onOpenMenu: openMobileMenu,
    onCloseMenu: closeMobileMenu,
    onRefresh: refreshCurrentPage,
  });
  const pullLabel = {
    idle: '',
    pulling: 'Puxe para atualizar',
    ready: 'Solte para atualizar',
    loading: 'Atualizando dados...',
    done: 'Dados atualizados',
    error: 'Falha ao atualizar',
    offline: 'Sem conexão',
  }[pullState];
  const notificationPeriod = useMemo(() => {
    const fim = new Date();
    fim.setHours(23, 59, 59, 999);
    const inicio = new Date(fim);
    inicio.setDate(inicio.getDate() - 29);
    inicio.setHours(0, 0, 0, 0);
    return { inicio: calendarDateValue(inicio), fim: calendarDateValue(fim), granularidade: 'diario' as const };
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
    function openSearch(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
      if (window.matchMedia('(max-width: 899px)').matches) {
        event.preventDefault();
        setMobileMenuOpen(false);
        setMobileSearchOpen(true);
        window.setTimeout(() => document.querySelector<HTMLInputElement>('[data-mobile-search] input')?.focus(), 0);
      } else if (collapsed) {
        event.preventDefault();
        toggleSidebar();
        window.setTimeout(() => document.querySelector<HTMLInputElement>('[data-sidebar-search] input')?.focus(), 0);
      }
    }
    window.addEventListener('keydown', openSearch);
    return () => window.removeEventListener('keydown', openSearch);
  }, [collapsed, toggleSidebar]);

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
    setReadState({ userId: user.id, values: proximas });
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
        ['/auditoria', '/usuarios', '/configuracoes', '/proprietario'].includes(item.to),
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
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            style={{ transform: collapsed ? 'rotate(180deg)' : undefined }}
          >
            <path
              d="m13 5-7 7 7 7m6-14-7 7 7 7"
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
          {!collapsed && <><span className={styles.brandCaption}>Mecânica Oeste Freios</span><span className={styles.brandSlogan}>Oficina em movimento</span></>}
        </div>

        <div className={styles.sidebarSearch} data-sidebar-search>
          {!collapsed ? <GlobalSearch className={styles.sidebarSearchField} placeholder="Buscar no sistema..." /> : (
            <button type="button" className={styles.collapsedSearch} title="Buscar no sistema" aria-label="Buscar no sistema" onClick={() => { toggleSidebar(); window.setTimeout(() => document.querySelector<HTMLInputElement>('[data-sidebar-search] input')?.focus(), 0); }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" /><path d="m20 20-4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </button>
          )}
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
                  aria-label={collapsed ? item.label : undefined}
                  onPointerEnter={() => prefetchRoute(item.to)}
                  onFocus={() => prefetchRoute(item.to)}
                >
                  <NavIcon name={item.icon} />
                  {!collapsed && <><span className={styles.sidebarItemLabel}>{item.label}</span>{item.to === '/' && <span className={styles.newBadge}>Novo</span>}<svg className={styles.activeChevron} width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.motivation} title="Mantendo sua oficina sempre em movimento">
            <span className={styles.motivationIcon} aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L14 13l-3-3 3.7-3.7Z" fill="currentColor" /></svg></span>
            {!collapsed && <strong>Mantendo sua oficina sempre em movimento</strong>}
          </div>
          <SidebarProfile collapsed={collapsed} onOpenProfile={() => setProfileOpen(true)} />
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.desktopHeader}>
          <div className={styles.headerActions}>
            <div className={styles.notificationWrapper} ref={notificationWrapperRef}>
              <button
                type="button"
                className={styles.headerIcon}
                title="Notificações"
                aria-label={notificacoes.length ? `Notificações (${notificacoes.length} não lidas)` : 'Notificações'}
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
                {notificacoes.length > 0 && (
                  <span className={styles.notificationCount} aria-hidden="true">
                    {notificacoes.length > 9 ? '9+' : notificacoes.length}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div className={styles.notificationMenu} role="region" aria-label="Notificações">
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
              {theme === 'dark' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.7" />
                  <path d="M12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12H5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
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
        {pullState !== 'idle' && <div className={styles.pullRefreshIndicator} role="status">{pullLabel}</div>}
        <OfflineBanner />
        <SubscriptionBanner />
        <InstallBanner />
        <PageRefreshProvider register={registerPageRefresh}>{children}</PageRefreshProvider>
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
            onTouchStart={() => prefetchRoute(item.to)}
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
          <div className={styles.mobileSearchBody} data-mobile-search>
            <GlobalSearch onNavigate={() => setMobileSearchOpen(false)} />
          </div>
        </div>
      )}
      <Drawer open={mobileMenuOpen} title="" side="left" className={styles.mobileMenuDrawer} onClose={() => setMobileMenuOpen(false)}>
        <div className={styles.mobileBrand}>
          <img
            src={branding?.logoUrl || clientLogo}
            alt={branding?.nomeEmpresa || 'Oeste Freios'}
          />
          <div>
            <strong>Mecânica Oeste Freios</strong>
            <span>Oficina em movimento</span>
          </div>
        </div>
        <button type="button" className={styles.mobileMenuSearch} onClick={() => { setMobileMenuOpen(false); setMobileSearchOpen(true); window.setTimeout(() => document.querySelector<HTMLInputElement>('[data-mobile-search] input')?.focus(), 0); }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" /><path d="m20 20-4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          <span>Buscar no sistema...</span><kbd>Ctrl + K</kbd>
        </button>
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
                  <span className={styles.mobileNavItemLabel}>{item.label}</span>
                  {item.to === '/' && <span className={styles.mobileNewBadge}>Novo</span>}
                  <svg className={styles.mobileActiveChevron} width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className={styles.mobileMenuFooter}>
          <div className={styles.mobileMotivation}>
            <span className={styles.motivationIcon} aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L14 13l-3-3 3.7-3.7Z" fill="currentColor" /></svg></span>
            <strong>Mantendo sua oficina sempre em movimento</strong>
          </div>
        <SidebarProfile
          collapsed={false}
          detailed
          onOpenProfile={() => {
            setMobileMenuOpen(false);
            setProfileOpen(true);
          }}
        />
        </div>
      </Drawer>
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}
