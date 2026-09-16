import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { logout } from '../../api/auth.api.js';
import { Avatar } from '../ui/Avatar.js';
import { useAuthStore } from '../../store/authStore.js';
import { useThemeStore } from '../../store/themeStore.js';
import styles from './SidebarProfile.module.css';

interface SidebarProfileProps {
  collapsed: boolean;
}

/**
 * Bloco de perfil no fim da sidebar (item pedido pelo usuário): avatar + e-mail logado,
 * clique abre um menu com tema e acesso à edição de perfil (`/perfil`, já editável).
 */
export function SidebarProfile({ collapsed }: SidebarProfileProps) {
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => {
      clearSession();
      navigate('/login', { replace: true });
    },
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
              navigate('/perfil');
            }}
          >
            Meu perfil
          </button>

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

      <button type="button" className={styles.trigger} onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <Avatar name={user.name} photoUrl={user.photoUrl ?? undefined} />
        {!collapsed && (
          <div className={styles.info}>
            <div className={styles.name}>{user.name}</div>
            <div className={styles.email}>{user.email}</div>
          </div>
        )}
        {!collapsed && <span className={styles.chevron} aria-hidden="true">⌄</span>}
      </button>
    </div>
  );
}
