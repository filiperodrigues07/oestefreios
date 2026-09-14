import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { logout } from '../api/auth.api.js';
import { useAuthStore } from '../store/authStore.js';
import { useThemeStore } from '../store/themeStore.js';

export function DashboardPlaceholderPage() {
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const navigate = useNavigate();

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => {
      clearSession();
      navigate('/login', { replace: true });
    },
  });

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-8)',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Olá, {user?.name}</h1>
          <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>Perfil: {user?.roleName}</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button onClick={toggleTheme} style={secondaryButtonStyle}>
            Tema: {theme === 'dark' ? 'Escuro' : 'Claro'}
          </button>
          <button onClick={() => logoutMutation.mutate()} style={secondaryButtonStyle}>
            Sair
          </button>
        </div>
      </header>

      <p style={{ color: 'var(--color-text-secondary)' }}>
        Permissões: {user?.permissions.join(', ')}
      </p>
    </div>
  );
}

const secondaryButtonStyle = {
  padding: '8px 14px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text-primary)',
  fontSize: 14,
  cursor: 'pointer',
} as const;
