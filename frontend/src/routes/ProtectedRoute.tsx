import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useAuthStore } from '../store/authStore.js';
import { hasPermission } from '../store/authStore.js';
import type { Permission } from '../types/auth.types.js';
import { ErrorScreen } from '../components/ui/ErrorScreen.js';

export function ProtectedRoute({
  children,
  requiredPermission,
  requireSuperAdmin,
}: {
  children: ReactNode;
  requiredPermission?: Permission;
  /** Área do proprietário: para os demais a página simplesmente não existe (404). */
  requireSuperAdmin?: boolean;
}) {
  const status = useAuthStore((s) => s.status);

  if (status === 'idle') {
    return <div style={{ padding: 24 }}>Carregando sessão...</div>;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  const mustChangePassword = useAuthStore.getState().user?.mustChangePassword;
  if (mustChangePassword && window.location.pathname !== '/alterar-senha') {
    return <Navigate to="/alterar-senha" replace />;
  }

  if (requireSuperAdmin && !useAuthStore.getState().user?.isSuperAdmin) {
    return <ErrorScreen error={{ status: 404 }} title="Página não encontrada" />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <ErrorScreen error={{ status: 403 }} />;
  }

  return <>{children}</>;
}
