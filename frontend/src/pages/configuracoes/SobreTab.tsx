import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { forceLogoutAllForUser, forceLogoutSession, listActiveSessions } from '../../api/session.api.js';
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, Skeleton, useToast } from '../../components/ui/index.js';
import type { ActiveSessionDTO } from '../../types/session.types.js';
import styles from './SobreTab.module.css';

type PendingAction = { type: 'one'; session: ActiveSessionDTO } | { type: 'all'; session: ActiveSessionDTO };

export function SobreTab() {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data, isLoading, isError, error } = useQuery({ queryKey: ['active-sessions'], queryFn: listActiveSessions });
  const action = useMutation({
    mutationFn: (target: PendingAction) => target.type === 'one'
      ? forceLogoutSession(target.session.id) : forceLogoutAllForUser(target.session.userId),
    onSuccess: () => { setPending(null); void queryClient.invalidateQueries({ queryKey: ['active-sessions'] }); void queryClient.invalidateQueries({ queryKey: ['audit-logs'] }); },
    onError: err => showToast(err instanceof Error ? err.message : 'Falha ao encerrar sessão.', 'danger'),
  });
  const counts = new Map<string, number>();
  for (const session of data ?? []) counts.set(session.userId, (counts.get(session.userId) ?? 0) + 1);

  return <div className={styles.page}>
    <section className={styles.heading}>
      <h2>Sessões ativas</h2>
      <p>Veja acessos atuais e encerre sessões quando necessário.</p>
    </section>
    {isLoading && <Skeleton height={120} />}
    {isError && <ErrorState error={error} />}
    {data?.length === 0 && <EmptyState title="Nenhuma sessão ativa." />}
    {data?.map(session => <Card key={session.id} elevated className={styles.sessionCard}>
      <strong>{session.userName}</strong> <span>{session.userEmail}</span>
      <div>IP: {session.ip ?? 'Desconhecido'} · {session.os} / {session.browser}</div>
      <div>Login: {new Date(session.createdAt).toLocaleString('pt-BR')} · Expira: {new Date(session.expiresAt).toLocaleString('pt-BR')}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
        <Button variant="secondary" size="sm" onClick={() => setPending({ type: 'one', session })}>Encerrar</Button>
        {(counts.get(session.userId) ?? 0) > 1 && <Button variant="secondary" size="sm" onClick={() => setPending({ type: 'all', session })}>Encerrar todas as sessões dessa pessoa</Button>}
      </div>
    </Card>)}
    <ConfirmDialog open={pending !== null} title="Encerrar sessão" danger
      description={pending?.type === 'all' ? `Encerrar todas as sessões de ${pending.session.userName}?` : `Encerrar esta sessão de ${pending?.session.userName ?? ''}?`}
      confirmLabel="Encerrar" loading={action.isPending} onConfirm={() => pending && action.mutate(pending)} onCancel={() => setPending(null)} />
  </div>;
}
