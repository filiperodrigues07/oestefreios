import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { logout } from '../../api/auth.api.js';
import { clearOfflineQueue } from '../../pwa/offlineQueue.js';
import { clearAllDrafts } from '../../utils/drafts.js';
import { clearLegacyApiCache } from '../../pwa/apiCache.js';
import { queryClient } from '../../api/queryClient.js';
import { useClickOutside } from '../../hooks/useClickOutside.js';
import { usePendingOperations } from '../../hooks/usePendingOperations.js';
import { Avatar } from '../ui/Avatar.js';
import { PendingOperationsModal } from './PendingOperationsModal.js';
import { useAuthStore } from '../../store/authStore.js';
import { useThemeStore } from '../../store/themeStore.js';
import styles from './SidebarProfile.module.css';

interface SidebarProfileProps {
  collapsed: boolean;
  onOpenProfile: () => void;
  detailed?: boolean;
}

/**
 * Bloco de perfil no fim da sidebar: avatar + e-mail logado, clique abre um menu
 * com tema e acesso ao modal "Meu perfil" (nunca navega pra uma tela cheia).
 */
export function SidebarProfile({
  collapsed,
  onOpenProfile,
  detailed = false,
}: SidebarProfileProps) {
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pendenciasAbertas, setPendenciasAbertas] = useState(false);
  const { operations: pendentes } = usePendingOperations();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: async () => {
      await Promise.allSettled([clearOfflineQueue(), clearLegacyApiCache()]);
      clearAllDrafts();
      queryClient.clear();
      clearSession();
      navigate('/login', { replace: true });
    },
  });

  useClickOutside(wrapperRef, () => setOpen(false), open);

  if (!user) return null;

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      {open && (
        <div className={styles.menu} role="menu">
          <div className={styles.menuHeader}>
            <Avatar name={user.name} photoUrl={user.photoUrl ?? undefined} size={36} />
            <div className={styles.menuIdentity}>
              <div className={styles.name}>{user.name}</div>
              <div className={styles.email}>{user.email}</div>
            </div>
          </div>

          <div className={styles.themeSection}>
            <span className={styles.themeLabel}>Tema</span>
            <div className={styles.themeOptions} role="group" aria-label="Tema">
              <button
                type="button"
                className={`${styles.themeOption} ${theme === 'dark' ? styles.themeOptionActive : ''}`}
                onClick={() => setTheme('dark')}
              >
                Escuro
              </button>
              <button
                type="button"
                className={`${styles.themeOption} ${theme === 'light' ? styles.themeOptionActive : ''}`}
                onClick={() => setTheme('light')}
              >
                Claro
              </button>
            </div>
          </div>

          <button
            type="button"
            className={styles.menuItem}
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onOpenProfile();
            }}
          >
            Meu perfil
          </button>

          {pendentes.length > 0 && (
            <button
              type="button"
              className={styles.menuItem}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setPendenciasAbertas(true);
              }}
            >
              Alterações pendentes ({pendentes.length})
            </button>
          )}

          <button
            type="button"
            className={`${styles.menuItem} ${styles.menuItemDanger}`}
            role="menuitem"
            onClick={() => logoutMutation.mutate()}
          >
            Sair
          </button>
        </div>
      )}

      <button
        type="button"
        className={`${styles.trigger} ${collapsed ? styles.triggerCollapsed : ''} ${detailed ? styles.triggerDetailed : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={collapsed ? user.name : undefined}
      >
        <Avatar name={user.name} photoUrl={user.photoUrl ?? undefined} size={42} />
        {!collapsed && (
          <div className={styles.info}>
            <div className={styles.name}>{user.name}</div>
            <div className={styles.email}>{user.email}</div>
            <div className={styles.role}>{user.roleName}</div>
            <div className={styles.online}>
              <span aria-hidden="true" />
              Online
            </div>
          </div>
        )}
        {!collapsed && (
          <span className={styles.chevron} aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="m5 9 7 7 7-7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        )}
      </button>

      <PendingOperationsModal open={pendenciasAbertas} operations={pendentes} onClose={() => setPendenciasAbertas(false)} />
    </div>
  );
}
