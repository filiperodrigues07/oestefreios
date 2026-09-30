import { useQuery } from '@tanstack/react-query';
import { getBillingStatus } from '../api/billing.api.js';
import { useAuthStore } from '../store/authStore.js';

/**
 * Sistema em modo consulta (mensalidade vencida/suspenso): o servidor recusa toda gravação, exceto do proprietário.
 * Com isso os botões de criar/salvar podem avisar ANTES de o usuário preencher tudo e só então receber o erro.
 * Mesma query do SubscriptionBanner (cache compartilhado).
 */
export function useSomenteLeitura(): boolean {
  const isSuperAdmin = useAuthStore((s) => s.user?.isSuperAdmin ?? false);
  const { data } = useQuery({
    queryKey: ['billing-status'],
    queryFn: getBillingStatus,
    refetchInterval: 10 * 60_000,
    staleTime: 5 * 60_000,
  });
  return data?.estado === 'SOMENTE_LEITURA' && !isSuperAdmin;
}
