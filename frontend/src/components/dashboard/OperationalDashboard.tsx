import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { prefetchOS } from '../../routes/prefetch.js';
import listaStyles from './OperationalDashboard.module.css';
import { getOperationalDashboard } from '../../api/dashboard.api.js';
import { StatTile } from '../charts/StatTile.js';
import { Button, Card, EmptyState, ErrorState, PriorityBadge, Skeleton, StatusBadge } from '../ui/index.js';
import styles from './AdminDashboard.module.css';

/** Dashboard operacional (seção 19 do briefing) — só "Minhas OS", nunca valor financeiro. */
export function OperationalDashboard() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard-me'],
    // "Minhas OS" do mecânico: OS atribuída por outra pessoa aparece sem precisar recarregar.
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
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
    return <ErrorState error={error} action={<Button onClick={() => refetch()}>Tentar de novo</Button>} />;
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

        <div className={listaStyles.list}>
          {data.minhasOS.map((os) => (
            <Link
              key={os.id}
              to={`/os/${os.id}`}
              className={listaStyles.link}
              onPointerEnter={() => prefetchOS(os.id)}
              onTouchStart={() => prefetchOS(os.id)}
              onFocus={() => prefetchOS(os.id)}
            >
              <Card elevated className={listaStyles.row}>
                <div>
                  <div className={listaStyles.title}>
                    OS #{os.numero} · {os.clienteCodigo}
                  </div>
                  <div className={listaStyles.meta}>
                    {os.equipamentoCodigo} · {new Date(os.dataAbertura).toLocaleDateString('pt-BR')}
                  </div>
                </div>
                <div className={listaStyles.badges}>
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
