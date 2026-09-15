import { useQuery } from '@tanstack/react-query';
import { getAdminDashboard } from '../../api/dashboard.api.js';
import { BarList } from '../charts/BarList.js';
import { formatCompactMoney, formatCompactNumber } from '../charts/formatters.js';
import { StatTile } from '../charts/StatTile.js';
import { toneToColor } from '../charts/toneColor.js';
import { OS_PRIORITY_CONFIG, OS_STATUS_CONFIG } from '../../constants/osStatus.js';
import { Button, ErrorState, Skeleton } from '../ui/index.js';
import type { OSPrioridade, OSStatus } from '../../types/os.types.js';
import styles from './AdminDashboard.module.css';

function formatHoras(horas: number | null): string {
  if (horas === null) return '—';
  if (horas < 24) return `${horas.toFixed(1)}h`;
  return `${(horas / 24).toFixed(1)}d`;
}

/** Dashboard administrativo (seção 18 do briefing) — indicadores financeiros só aparecem se o backend os enviar. */
export function AdminDashboard() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard-admin'],
    queryFn: getAdminDashboard,
  });

  if (isLoading) {
    return (
      <div className={styles.tiles}>
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

  const statusItems = (Object.keys(data.countsByStatus) as OSStatus[])
    .filter((status) => data.countsByStatus[status] > 0)
    .map((status) => ({
      label: OS_STATUS_CONFIG[status].label,
      value: data.countsByStatus[status],
      color: toneToColor(OS_STATUS_CONFIG[status].tone),
    }));

  const prioridadeItems = (Object.keys(data.countsByPrioridade) as OSPrioridade[])
    .filter((p) => data.countsByPrioridade[p] > 0)
    .map((p) => ({
      label: OS_PRIORITY_CONFIG[p].label,
      value: data.countsByPrioridade[p],
      color: toneToColor(OS_PRIORITY_CONFIG[p].tone),
    }));

  const produtosItems = data.produtosMaisUtilizados.map((p) => ({ label: p.descricao, value: p.quantidade }));
  const servicosItems = data.servicosMaisUtilizados.map((s) => ({ label: s.descricao, value: s.quantidade }));
  const tecnicoItems = data.porTecnico.map((t) => ({ label: t.tecnicoId.slice(0, 8), value: t.count }));

  return (
    <div>
      <div className={styles.tiles}>
        <StatTile label="OS abertas" value={formatCompactNumber(data.countsByStatus.ABERTA)} />
        <StatTile label="OS em andamento" value={formatCompactNumber(data.countsByStatus.EM_ANDAMENTO)} />
        <StatTile
          label="OS aguardando"
          value={formatCompactNumber(data.countsByStatus.AGUARDANDO_PECA + data.countsByStatus.AGUARDANDO_CLIENTE)}
        />
        <StatTile label="OS concluídas" value={formatCompactNumber(data.countsByStatus.CONCLUIDA)} />
        <StatTile label="OS canceladas" value={formatCompactNumber(data.countsByStatus.CANCELADA)} />
        <StatTile label="Tempo médio de conclusão" value={formatHoras(data.tempoMedioConclusaoHoras)} />
      </div>

      {data.financeiro && (
        <div className={styles.tiles} style={{ marginTop: 'var(--space-3)' }}>
          <StatTile label="Faturamento" value={formatCompactMoney(data.financeiro.faturamentoTotal)} />
          <StatTile label="Valor em serviços" value={formatCompactMoney(data.financeiro.valorServicos)} />
          <StatTile label="Valor em produtos" value={formatCompactMoney(data.financeiro.valorProdutos)} />
          <StatTile label="Ticket médio" value={formatCompactMoney(data.financeiro.ticketMedio)} />
        </div>
      )}

      <div className={styles.charts} style={{ marginTop: 'var(--space-6)' }}>
        <div className={styles.card}>
          <h2 className={styles.sectionTitle}>OS por status</h2>
          <BarList items={statusItems} />
        </div>
        <div className={styles.card}>
          <h2 className={styles.sectionTitle}>OS por prioridade</h2>
          <BarList items={prioridadeItems} />
        </div>
      </div>

      <div className={styles.charts} style={{ marginTop: 'var(--space-4)' }}>
        <div className={styles.card}>
          <h2 className={styles.sectionTitle}>Produtos mais utilizados</h2>
          <BarList items={produtosItems} emptyLabel="Nenhum produto lançado ainda." />
        </div>
        <div className={styles.card}>
          <h2 className={styles.sectionTitle}>Serviços mais utilizados</h2>
          <BarList items={servicosItems} emptyLabel="Nenhum serviço lançado ainda." />
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.card}>
          <h2 className={styles.sectionTitle}>OS por técnico</h2>
          <BarList items={tecnicoItems} emptyLabel="Nenhuma OS com técnico atribuído ainda." />
        </div>
      </div>
    </div>
  );
}
