import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { logout } from '../api/auth.api.js';
import { Badge, Button, Card, LinkButton } from '../components/ui/index.js';
import { hasPermission, useAuthStore } from '../store/authStore.js';
import { useThemeStore } from '../store/themeStore.js';

export function PerfilPage() {
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
    <div style={{ padding: 'var(--space-6)', maxWidth: 560 }}>
      <h1 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--font-size-xl)' }}>Perfil</h1>

      <Card style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div>
          <div style={{ fontWeight: 600 }}>{user?.name}</div>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>{user?.email}</div>
        </div>

        <div>
          <Badge tone="primary">{user?.roleName}</Badge>
        </div>

        <div>
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
            Permissões
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
            {user?.permissions.map((p) => (
              <Badge key={p} tone="neutral">
                {p}
              </Badge>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={toggleTheme}>
            Tema: {theme === 'dark' ? 'Escuro' : 'Claro'}
          </Button>
          {hasPermission('SYSTEM_SETTINGS') && (
            <LinkButton to="/auditoria" variant="secondary">
              Auditoria
            </LinkButton>
          )}
          <Button variant="danger" onClick={() => logoutMutation.mutate()} loading={logoutMutation.isPending}>
            Sair
          </Button>
        </div>
      </Card>
    </div>
  );
}
