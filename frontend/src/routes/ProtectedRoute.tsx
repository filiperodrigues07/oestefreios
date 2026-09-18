import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useAuthStore } from '../store/authStore.js';
import { hasPermission } from '../store/authStore.js';
import type { Permission } from '../types/auth.types.js';

export function ProtectedRoute({ children, requiredPermission }: { children: ReactNode; requiredPermission?: Permission }) {
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

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
