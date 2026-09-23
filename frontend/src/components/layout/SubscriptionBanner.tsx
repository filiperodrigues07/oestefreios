import { useQuery } from '@tanstack/react-query';
import { getBillingStatus } from '../../api/billing.api.js';
import { useAuthStore } from '../../store/authStore.js';
import styles from './SubscriptionBanner.module.css';

/** Aviso da mensalidade: vencendo/vencida só pra quem administra; somente leitura pra todos (explica por que não salva). */
export function SubscriptionBanner() {
  const isAdmin = useAuthStore((s) => s.user?.permissions.includes('SYSTEM_SETTINGS') ?? false);
  const { data } = useQuery({
    queryKey: ['billing-status'],
    queryFn: getBillingStatus,
    refetchInterval: 10 * 60_000,
    staleTime: 5 * 60_000,
  });

  if (!data || data.estado === 'EM_DIA') return null;
  if (data.estado !== 'SOMENTE_LEITURA' && !isAdmin) return null;

  const tom = data.estado === 'A_VENCER' ? styles.warning : styles.danger;
  return (
    <div className={`${styles.banner} ${tom}`} role="status">
      {data.mensagem}
      {isAdmin && data.estado === 'SOMENTE_LEITURA' && ' Como administrador, você continua com acesso total.'}
    </div>
  );
}
