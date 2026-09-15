import type { ReactNode } from 'react';
import { createBrowserRouter } from 'react-router';
import { AppShell } from '../components/layout/AppShell.js';
import { AuditLogPage } from '../pages/AuditLogPage.js';
import { HomePage } from '../pages/HomePage.js';
import { LoginPage } from '../pages/LoginPage.js';
import { OSCreatePage } from '../pages/OSCreatePage.js';
import { OSDetailPage } from '../pages/OSDetailPage.js';
import { OSListPage } from '../pages/OSListPage.js';
import { PerfilPage } from '../pages/PerfilPage.js';
import { ProdutosPage } from '../pages/ProdutosPage.js';
import { ProtectedRoute } from './ProtectedRoute.js';

function withShell(page: ReactNode) {
  return (
    <ProtectedRoute>
      <AppShell>{page}</AppShell>
    </ProtectedRoute>
  );
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/', element: withShell(<HomePage />) },
  { path: '/os', element: withShell(<OSListPage />) },
  { path: '/os/nova', element: withShell(<OSCreatePage />) },
  { path: '/os/:id', element: withShell(<OSDetailPage />) },
  { path: '/produtos', element: withShell(<ProdutosPage />) },
  { path: '/perfil', element: withShell(<PerfilPage />) },
  { path: '/auditoria', element: withShell(<AuditLogPage />) },
]);
