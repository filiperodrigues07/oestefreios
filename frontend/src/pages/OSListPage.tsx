import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { listarOS } from '../api/os.api.js';
import { OS_STATUS_CONFIG } from '../constants/osStatus.js';
import { hasPermission } from '../store/authStore.js';
import { PriorityBadge, StatusBadge } from '../components/ui/StatusBadge.js';
import { Button, Card, EmptyState, ErrorState, LinkButton, Select, Skeleton } from '../components/ui/index.js';
import type { OSStatus } from '../types/os.types.js';

const STATUS_OPTIONS = Object.entries(OS_STATUS_CONFIG).map(([value, cfg]) => ({ value, label: cfg.label }));

export function OSListPage() {
  const [status, setStatus] = useState<OSStatus | ''>('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['os-list', status],
    queryFn: () => listarOS({ status: status || undefined }),
  });

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 760 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h1 style={{ margin: 0, fontSize: 'var(--font-size-xl)' }}>Ordens de Serviço</h1>
        {hasPermission('OS_CREATE') && (
          <LinkButton to="/os/nova" size="sm">
            + Nova OS
          </LinkButton>
        )}
      </div>

      <div style={{ maxWidth: 260, marginBottom: 'var(--space-4)' }}>
        <Select
          label="Status"
          placeholder="Todos os status"
          value={status}
          onChange={(e) => setStatus(e.target.value as OSStatus)}
          options={STATUS_OPTIONS}
        />
      </div>

      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <Skeleton height={64} />
          <Skeleton height={64} />
          <Skeleton height={64} />
        </div>
      )}

      {isError && <ErrorState action={<Button onClick={() => refetch()}>Tentar de novo</Button>} />}

      {!isLoading && !isError && data?.items.length === 0 && (
        <EmptyState title="Nenhuma OS encontrada" description="Ajuste o filtro ou crie uma nova OS." />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {data?.items.map((os) => (
          <Link key={os.id} to={`/os/${os.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <Card
              elevated
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>
                  OS #{os.numero} · {os.clienteCodigo}
                </div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  {os.problema}
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
  );
}
