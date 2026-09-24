import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { forceLogoutSession, getLicenca } from '../../api/session.api.js';
import { Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Skeleton, useToast, type BadgeTone } from '../../components/ui/index.js';
import type { LicenseSummaryDTO, StatusPresenca, UsuarioLicencaDTO } from '../../types/session.types.js';
import { AssinaturaSection } from './AssinaturaSection.js';
import styles from './SobreTab.module.css';

const STATUS_LABEL: Record<StatusPresenca, string> = { online: 'Online', ocioso: 'Ocioso', offline: 'Offline' };
const STATUS_TONE: Record<StatusPresenca, BadgeTone> = { online: 'success', ocioso: 'warning', offline: 'neutral' };

function tempoRelativo(iso: string | null): string {
  if (!iso) return 'Nunca';
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutos < 1) return 'agora mesmo';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  return `há ${Math.floor(horas / 24)} d`;
}

function LicenseStrip({ license }: { license: LicenseSummaryDTO }) {
  const unlimited = license.limite === 0;
  const ratio = unlimited ? 0 : license.emUso / license.limite;
  const level = ratio >= 1 ? styles.licenseFull : ratio >= 0.8 ? styles.licenseWarn : styles.licenseOk;
  return <section className={`${styles.license} ${level}`} aria-label="Licenças em uso">
    <strong>Licenças: {unlimited ? `${license.emUso} em uso (sem limite)` : `${license.emUso} de ${license.limite} em uso`}</strong>
    {!unlimited && <div className={styles.meter} role="progressbar" aria-valuemin={0} aria-valuemax={license.limite} aria-valuenow={license.emUso} aria-label="Vagas de licença ocupadas">
      <span style={{ width: `${Math.min(100, ratio * 100)}%` }} />
    </div>}
    <span>{ratio >= 1 ? 'Todas as vagas ocupadas. ' : ''}Vaga livre após {license.idleMinutes} min sem uso, ou ao derrubar/sair. Administrador sempre entra.</span>
  </section>;
}

function UserRow({ user, onKick }: { user: UsuarioLicencaDTO; onKick: (user: UsuarioLicencaDTO) => void }) {
  return <li className={styles.userRow}>
    <div className={styles.userMain}>
      <Avatar name={user.name} photoUrl={user.photoUrl ?? undefined} size={36} />
      <div className={styles.userText}>
        <strong>{user.name}</strong>
        <span>{user.email} · {user.roleName}</span>
      </div>
    </div>
    <div className={styles.userStatus}>
      <Badge tone={STATUS_TONE[user.status]}><span className={`${styles.dot} ${styles[user.status]}`} aria-hidden="true" />{STATUS_LABEL[user.status]}</Badge>
      <span className={styles.muted}>{tempoRelativo(user.lastSeenAt)}</span>
    </div>
    <div className={styles.userDevice}>
      {user.sessao ? <>
        <span>{user.sessao.os} · {user.sessao.browser}</span>
        <span className={styles.muted}>IP {user.sessao.ip ?? 'desconhecido'} · login {new Date(user.sessao.loginAt).toLocaleString('pt-BR')}</span>
      </> : <span className={styles.muted}>Sem sessão ativa</span>}
    </div>
    <div className={styles.userAction}>
      {user.sessao && <Button variant="secondary" size="sm" onClick={() => onKick(user)}>Derrubar</Button>}
    </div>
  </li>;
}

export function SobreTab() {
  const [pending, setPending] = useState<UsuarioLicencaDTO | null>(null);
  const [soOnline, setSoOnline] = useState(false);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const license = useQuery({ queryKey: ['license'], queryFn: getLicenca, refetchInterval: 30_000 });
  const kick = useMutation({
    mutationFn: (user: UsuarioLicencaDTO) => forceLogoutSession(user.sessao!.id),
    onSuccess: () => {
      setPending(null);
      showToast('Sessão encerrada. Vaga liberada.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['license'] });
      void queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
    onError: err => showToast(err instanceof Error ? err.message : 'Falha ao encerrar sessão.', 'danger'),
  });
  const lista = (license.data?.usuarios ?? []).filter(user => !soOnline || user.status !== 'offline');

  return <div className={styles.page}>
    <AssinaturaSection />

    <section className={styles.heading}>
      <h2>Usuários e licenças</h2>
      <p>Veja quem está conectado agora e libere uma vaga quando necessário.</p>
    </section>
    {license.data && <LicenseStrip license={license.data} />}
    {license.isLoading && <Skeleton height={120} />}
    {license.isError && <ErrorState error={license.error} />}
    {license.data && <Card elevated className={styles.usersCard}>
      <label className={styles.filter}>
        <input type="checkbox" checked={soOnline} onChange={event => setSoOnline(event.target.checked)} />
        Mostrar só quem está conectado
      </label>
      {lista.length === 0
        ? <EmptyState title={soOnline ? 'Ninguém conectado agora.' : 'Nenhum usuário ativo.'} />
        : <ul className={styles.userList}>{lista.map(user => <UserRow key={user.id} user={user} onKick={setPending} />)}</ul>}
    </Card>}

    <ConfirmDialog open={pending !== null} title="Derrubar usuário" danger
      description={`Derrubar ${pending?.name ?? ''}? A sessão é encerrada e a vaga é liberada na hora.`}
      confirmLabel="Derrubar" loading={kick.isPending} onConfirm={() => pending && kick.mutate(pending)} onCancel={() => setPending(null)} />
  </div>;
}
