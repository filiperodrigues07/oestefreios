import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter } from 'react-router';
import { AppShell } from '../components/layout/AppShell.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { HomePage } from '../pages/HomePage.js';
import { LoginPage } from '../pages/LoginPage.js';
import { ProtectedRoute } from './ProtectedRoute.js';

// Lazy: cada página só entra no bundle quando a rota é visitada, em vez de tudo no carregamento inicial.
// Login/Home ficam eager porque são a primeira tela — lazy não ajudaria ali.
const AuditLogPage = lazy(() => import('../pages/AuditLogPage.js').then((m) => ({ default: m.AuditLogPage })));
const AlterarSenhaPage = lazy(() => import('../pages/AlterarSenhaPage.js').then((m) => ({ default: m.AlterarSenhaPage })));
const ClienteFormPage = lazy(() => import('../pages/ClienteFormPage.js').then((m) => ({ default: m.ClienteFormPage })));
const ClientesPage = lazy(() => import('../pages/ClientesPage.js').then((m) => ({ default: m.ClientesPage })));
const ConfiguracoesPage = lazy(() => import('../pages/ConfiguracoesPage.js').then((m) => ({ default: m.ConfiguracoesPage })));
const EsqueciSenhaPage = lazy(() => import('../pages/EsqueciSenhaPage.js').then((m) => ({ default: m.EsqueciSenhaPage })));
const OSFormPage = lazy(() => import('../pages/OSFormPage.js').then((m) => ({ default: m.OSFormPage })));
const OSListPage = lazy(() => import('../pages/OSListPage.js').then((m) => ({ default: m.OSListPage })));
const ProdutosPage = lazy(() => import('../pages/ProdutosPage.js').then((m) => ({ default: m.ProdutosPage })));
const RedefinirSenhaPage = lazy(() => import('../pages/RedefinirSenhaPage.js').then((m) => ({ default: m.RedefinirSenhaPage })));
const RelatoriosPage = lazy(() => import('../pages/RelatoriosPage.js').then((m) => ({ default: m.RelatoriosPage })));
const UsuariosPage = lazy(() => import('../pages/UsuariosPage.js').then((m) => ({ default: m.UsuariosPage })));

function PageLoadingFallback() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-4)' }}>
      <Skeleton height={40} />
      <Skeleton height={200} />
    </div>
  );
}

function lazyPage(page: ReactNode): ReactNode {
  return <Suspense fallback={<PageLoadingFallback />}>{page}</Suspense>;
}

function withShell(page: ReactNode) {
  return (
    <ProtectedRoute>
      <AppShell>{lazyPage(page)}</AppShell>
    </ProtectedRoute>
  );
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/esqueci-senha', element: lazyPage(<EsqueciSenhaPage />) },
  { path: '/redefinir-senha', element: lazyPage(<RedefinirSenhaPage />) },
  { path: '/alterar-senha', element: <ProtectedRoute>{lazyPage(<AlterarSenhaPage />)}</ProtectedRoute> },
  { path: '/', element: withShell(<HomePage />) },
  { path: '/os', element: withShell(<OSListPage />) },
  { path: '/os/nova', element: withShell(<OSFormPage />) },
  { path: '/os/:id', element: withShell(<OSFormPage />) },
  { path: '/produtos', element: withShell(<ProdutosPage />) },
  { path: '/clientes', element: withShell(<ClientesPage />) },
  { path: '/clientes/novo', element: withShell(<ClienteFormPage />) },
  { path: '/clientes/:codigo/editar', element: withShell(<ClienteFormPage />) },
  {
    path: '/relatorios',
    element: (
      <ProtectedRoute requiredPermission="REPORT_VIEW">
        <AppShell>{lazyPage(<RelatoriosPage />)}</AppShell>
      </ProtectedRoute>
    ),
  },
  { path: '/auditoria', element: withShell(<AuditLogPage />) },
  { path: '/configuracoes', element: withShell(<ConfiguracoesPage />) },
  { path: '/usuarios', element: withShell(<UsuariosPage />) },
]);
