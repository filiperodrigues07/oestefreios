import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { listarAuditLogs } from '../api/auditLog.api.js';
import { Card, EmptyState, ErrorState, Modal, PageHeader, Pagination, Skeleton } from '../components/ui/index.js';
import type { AuditLogDTO } from '../types/auditLog.types.js';
import styles from './AuditLogPage.module.css';

const EVENT_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: 'Login bem-sucedido',
  LOGIN_FAILURE: 'Tentativa de login falhou',
  LOGOUT: 'Logout',
  TOKEN_REUSE_DETECTED: 'Reuso de token detectado (possível roubo de sessão)',
  OS_CREATED: 'OS criada',
  OS_UPDATED: 'OS atualizada',
  OS_STATUS_CHANGED: 'Status da OS alterado',
  OS_PRODUCT_ADDED: 'Produto adicionado à OS',
  OS_PRODUCT_REMOVED: 'Produto removido da OS',
  OS_PRODUCT_UPDATED: 'Produto atualizado na OS',
  OS_SERVICE_ADDED: 'Serviço adicionado à OS',
  OS_SERVICE_REMOVED: 'Serviço removido da OS',
  OS_SERVICE_UPDATED: 'Serviço atualizado na OS',
};

/** Trilha de auditoria (seção 24 do briefing) — só acessível com SYSTEM_SETTINGS (rota já protege no backend). */
export function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [selecionado, setSelecionado] = useState<AuditLogDTO | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['audit-logs', page, limit],
    queryFn: () => listarAuditLogs(page, limit),
  });

  function handleLimitChange(novoLimit: number) {
    setLimit(novoLimit);
    setPage(1);
  }

  return (
    <div className={styles.page}>
      <PageHeader title="Auditoria" description="Acompanhe os eventos registrados no sistema." />

      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <Skeleton height={56} />
          <Skeleton height={56} />
          <Skeleton height={56} />
        </div>
      )}

      {isError && <ErrorState />}

      {!isLoading && !isError && data?.items.length === 0 && <EmptyState title="Nenhum evento registrado ainda." />}

      <div className={styles.logList}>
        {data?.items.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setSelecionado(entry)}
            style={{ all: 'unset', cursor: 'pointer', display: 'block' }}
          >
            <Card elevated style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{EVENT_LABELS[entry.event] ?? entry.event}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  {entry.userName ?? 'Sistema'}
                  {entry.entityType && ` · ${entry.entityType} ${entry.entityId?.slice(0, 8)}`}
                </div>
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                {new Date(entry.createdAt).toLocaleString('pt-BR')}
              </div>
            </Card>
          </button>
        ))}
      </div>

      {data && (
        <div className={styles.pagination}>
          <Pagination page={data.page} limit={data.limit} total={data.total} onPageChange={setPage} onLimitChange={handleLimitChange} />
        </div>
      )}

      <Modal
        open={selecionado !== null}
        title={selecionado ? (EVENT_LABELS[selecionado.event] ?? selecionado.event) : ''}
        onClose={() => setSelecionado(null)}
      >
        {selecionado && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <Row label="Usuário" value={selecionado.userName ?? 'Sistema'} />
            <Row label="Data/hora" value={new Date(selecionado.createdAt).toLocaleString('pt-BR')} />
            {selecionado.entityType && <Row label="Entidade" value={`${selecionado.entityType} ${selecionado.entityId ?? ''}`} />}
            {selecionado.ip && <Row label="IP" value={selecionado.ip} />}
            {selecionado.changes !== null && selecionado.changes !== undefined && (
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
                  Dados alterados
                </div>
                <pre
                  style={{
                    background: 'var(--color-neutral-surface)',
                    borderRadius: 'var(--radius-sm)',
                    padding: 'var(--space-3)',
                    fontSize: 'var(--font-size-xs)',
                    overflowX: 'auto',
                    margin: 0,
                  }}
                >
                  {JSON.stringify(selecionado.changes, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{label}</div>
      <div style={{ fontWeight: 500 }}>{value}</div>
    </div>
  );
}
