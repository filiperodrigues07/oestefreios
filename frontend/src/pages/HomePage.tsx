import { Navigate } from 'react-router';
import { AdminDashboard } from '../components/dashboard/AdminDashboard.js';
import { OperationalDashboard } from '../components/dashboard/OperationalDashboard.js';
import { hasPermission } from '../store/authStore.js';
import styles from './HomePage.module.css';

/** Dashboard administrativo ou operacional, conforme a permissão já recebida na sessão. */
export function HomePage() {
  const isAdmin = hasPermission('REPORT_VIEW');
  const canSeeDashboard = hasPermission('REPORT_VIEW') || hasPermission('FINANCIAL_VIEW');

  if (!canSeeDashboard) {
    return <Navigate to="/os" replace />;
  }

  return (
    <div className={styles.page}>
      {isAdmin ? <AdminDashboard /> : <OperationalDashboard />}
    </div>
  );
}
