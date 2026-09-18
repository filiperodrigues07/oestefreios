import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { getOperationalDashboard } from '../../api/dashboard.api.js';
import { StatTile } from '../charts/StatTile.js';
import { Button, Card, EmptyState, ErrorState, PriorityBadge, Skeleton, StatusBadge } from '../ui/index.js';
import styles from './AdminDashboard.module.css';

/** Dashboard operacional (seção 19 do briefing) — só "Minhas OS", nunca valor financeiro. */
export function OperationalDashboard() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard-me'],
    queryFn: getOperationalDashboard,
  });

  if (isLoading) {
    return (
      <div className={styles.tiles}>
        <Skeleton height={88} />
        <Skeleton height={88} />
        <Skeleton height={88} />
        <Skeleton height={88} />
        <Skeleton height={88} />
      </div>
    );
  }

  if (isError || !data) {
    return <ErrorState action={<Button onClick={() => refetch()}>Tentar de novo</Button>} />;
  }

  return (
    <div>
      <div className={styles.tiles}>
        <StatTile label="Em atendimento" value={String(data.counts.emAtendimento)} />
        <StatTile label="Aguardando" value={String(data.counts.aguardando)} />
        <StatTile label="Prontas" value={String(data.counts.prontas)} />
        <StatTile label="Encerradas" value={String(data.counts.encerradas)} />
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>OS atribuídas a você na plataforma</h2>

        {data.minhasOS.length === 0 && (
          <EmptyState title="Nenhuma OS atribuída a você" description="As atribuições são gerenciadas pela plataforma." />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {data.minhasOS.map((os) => (
            <Link key={os.id} to={`/os/${os.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <Card elevated style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    OS #{os.numero} · {os.clienteCodigo}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    {os.equipamentoCodigo} · {new Date(os.dataAbertura).toLocaleDateString('pt-BR')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
                  <PriorityBadge priority={os.prioridade} />
                  <StatusBadge status={os.status} />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
