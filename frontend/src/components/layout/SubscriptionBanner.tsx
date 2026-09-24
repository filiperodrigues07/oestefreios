import { useQuery } from '@tanstack/react-query';
import { getBillingStatus } from '../../api/billing.api.js';
import { useAuthStore } from '../../store/authStore.js';
import styles from './SubscriptionBanner.module.css';

/** Aviso da mensalidade: vencendo/vencida só para o proprietário (o servidor já esconde isso dos demais); modo consulta para todos (explica por que não salva). */
export function SubscriptionBanner() {
  const isAdmin = useAuthStore((s) => s.user?.isSuperAdmin ?? false);
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
      {isAdmin && data.estado === 'SOMENTE_LEITURA' && ` ${data.origem === 'MANUAL' ? 'Suspensão manual.' : ''} Como proprietário, você continua com acesso total.`}
    </div>
  );
}
