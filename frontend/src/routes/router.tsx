import type { ReactNode } from 'react';
import { createBrowserRouter } from 'react-router';
import { AppShell } from '../components/layout/AppShell.js';
import { AuditLogPage } from '../pages/AuditLogPage.js';
import { ClienteFormPage } from '../pages/ClienteFormPage.js';
import { ClientesPage } from '../pages/ClientesPage.js';
import { ConfiguracoesPage } from '../pages/ConfiguracoesPage.js';
import { EsqueciSenhaPage } from '../pages/EsqueciSenhaPage.js';
import { HomePage } from '../pages/HomePage.js';
import { LoginPage } from '../pages/LoginPage.js';
import { OSFormPage } from '../pages/OSFormPage.js';
import { OSListPage } from '../pages/OSListPage.js';
import { PerfilPage } from '../pages/PerfilPage.js';
import { ProdutosPage } from '../pages/ProdutosPage.js';
import { RedefinirSenhaPage } from '../pages/RedefinirSenhaPage.js';
import { UsuariosPage } from '../pages/UsuariosPage.js';
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
  { path: '/esqueci-senha', element: <EsqueciSenhaPage /> },
  { path: '/redefinir-senha', element: <RedefinirSenhaPage /> },
  { path: '/', element: withShell(<HomePage />) },
  { path: '/os', element: withShell(<OSListPage />) },
  { path: '/os/nova', element: withShell(<OSFormPage />) },
  { path: '/os/:id', element: withShell(<OSFormPage />) },
  { path: '/produtos', element: withShell(<ProdutosPage />) },
  { path: '/clientes', element: withShell(<ClientesPage />) },
  { path: '/clientes/novo', element: withShell(<ClienteFormPage />) },
  { path: '/clientes/:codigo/editar', element: withShell(<ClienteFormPage />) },
  { path: '/perfil', element: withShell(<PerfilPage />) },
  { path: '/auditoria', element: withShell(<AuditLogPage />) },
  { path: '/configuracoes', element: withShell(<ConfiguracoesPage />) },
  { path: '/usuarios', element: withShell(<UsuariosPage />) },
]);
