import type { ReactNode } from 'react';
import { createBrowserRouter } from 'react-router';
import { AppShell } from '../components/layout/AppShell.js';
import { HomePage } from '../pages/HomePage.js';
import { LoginPage } from '../pages/LoginPage.js';
import { OSPage } from '../pages/OSPage.js';
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
  { path: '/os', element: withShell(<OSPage />) },
  { path: '/produtos', element: withShell(<ProdutosPage />) },
  { path: '/perfil', element: withShell(<PerfilPage />) },
]);
