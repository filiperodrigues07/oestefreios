import { AdminDashboard } from '../components/dashboard/AdminDashboard.js';
import { OperationalDashboard } from '../components/dashboard/OperationalDashboard.js';
import { hasPermission, useAuthStore } from '../store/authStore.js';

/** Dashboard administrativo (indicadores completos) ou operacional ("Minhas OS"), conforme REPORT_VIEW. */
export function HomePage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = hasPermission('REPORT_VIEW');

  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <h1 style={{ margin: 0, fontSize: 'var(--font-size-xl)' }}>Olá, {user?.name}</h1>
      <p style={{ color: 'var(--color-text-secondary)', margin: 'var(--space-1) 0 var(--space-6)' }}>
        Perfil: {user?.roleName}
      </p>

      {isAdmin ? <AdminDashboard /> : <OperationalDashboard />}
    </div>
  );
}
