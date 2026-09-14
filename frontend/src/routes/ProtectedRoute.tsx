import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useAuthStore } from '../store/authStore.js';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);

  if (status === 'idle') {
    return <div style={{ padding: 24 }}>Carregando sessão...</div>;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
