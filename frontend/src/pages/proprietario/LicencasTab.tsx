import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { getLicencaConfig, saveLicencaConfig } from '../../api/superadmin.api.js';
import { forceLogoutSession, getLicenca } from '../../api/session.api.js';
import { Avatar, Badge, Button, Card, Checkbox, ConfirmDialog, EmptyState, ErrorState, Input, Skeleton, useToast, type BadgeTone } from '../../components/ui/index.js';
import type { LicenseSummaryDTO, StatusPresenca, UsuarioLicencaDTO } from '../../types/session.types.js';
import styles from './LicencasTab.module.css';

const STATUS_LABEL: Record<StatusPresenca, string> = { online: 'Online', ocioso: 'Ocioso', offline: 'Offline' };
const STATUS_TONE: Record<StatusPresenca, BadgeTone> = { online: 'success', ocioso: 'warning', offline: 'neutral' };

export function tempoRelativo(iso: string | null): string {
  if (!iso) return 'Nunca';
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutos < 1) return 'agora mesmo';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  return `há ${Math.floor(horas / 24)} d`;
}

/** Medidor de vagas: cor + texto (nunca só cor) — verde, atenção a partir de 80%, cheio em vermelho. */
export function LicenseStrip({ license }: { license: LicenseSummaryDTO }) {
  const unlimited = license.limite === 0;
  const ratio = unlimited ? 0 : license.emUso / license.limite;
  const level = ratio >= 1 ? styles.licenseFull : ratio >= 0.8 ? styles.licenseWarn : styles.licenseOk;
  return <section className={`${styles.license} ${level}`} aria-label="Licenças em uso">
    <strong>Licenças: {unlimited ? `${license.emUso} em uso (sem limite)` : `${license.emUso} de ${license.limite} em uso`}</strong>
    {!unlimited && <div className={styles.meter} role="progressbar" aria-valuemin={0} aria-valuemax={license.limite} aria-valuenow={license.emUso} aria-label="Vagas de licença ocupadas">
      <span style={{ width: `${Math.min(100, ratio * 100)}%` }} />
    </div>}
    <span>{ratio >= 1 ? 'Todas as vagas ocupadas. ' : ''}Vaga livre após {license.idleMinutes} min sem uso, ou ao derrubar/sair. Você (proprietário) sempre entra.</span>
  </section>;
}

function UserRow({ user, onKick }: { user: UsuarioLicencaDTO; onKick: (user: UsuarioLicencaDTO) => void }) {
  return <li className={styles.userRow}>
    <div className={styles.userMain}>
      <Avatar name={user.name} photoUrl={user.photoUrl ?? undefined} size={36} />
      <div className={styles.userText}>
        <strong>{user.name}{user.isSuperAdmin && <Badge tone="primary" className={styles.ownerBadge}>Proprietário</Badge>}</strong>
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

function LicencaConfigCard() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data, isLoading, isError, error } = useQuery({ queryKey: ['licenca-config'], queryFn: getLicencaConfig });
  const [limite, setLimite] = useState('5');
  const [idle, setIdle] = useState('15');
  const [sessaoUnica, setSessaoUnica] = useState(true);
  useEffect(() => {
    if (!data) return;
    setLimite(String(data.limite));
    setIdle(String(data.idleMinutes));
    setSessaoUnica(data.sessaoUnica);
  }, [data]);

  const limiteNum = Number(limite);
  const idleNum = Number(idle);
  const valido = Number.isInteger(limiteNum) && limiteNum >= 0 && limiteNum <= 500 && Number.isInteger(idleNum) && idleNum >= 1 && idleNum <= 240;
  const alterado = data ? (limiteNum !== data.limite || idleNum !== data.idleMinutes || sessaoUnica !== data.sessaoUnica) : false;

  const mutation = useMutation({
    mutationFn: saveLicencaConfig,
    onSuccess: () => {
      showToast('Licenças salvas. Vale a partir do próximo login.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['licenca-config'] });
      void queryClient.invalidateQueries({ queryKey: ['license'] });
      void queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
    onError: err => showToast(err instanceof Error ? err.message : 'Não foi possível salvar.', 'danger'),
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (valido) mutation.mutate({ limite: limiteNum, idleMinutes: idleNum, sessaoUnica });
  }

  return <Card elevated className={styles.configCard}>
    <div className={styles.configHead}>
      <h3>Regras de licença</h3>
      {data && <Badge tone={data.origem.limite === 'painel' ? 'primary' : 'neutral'}>{data.origem.limite === 'painel' ? 'Definido por você' : 'Padrão do servidor'}</Badge>}
    </div>
    {isLoading && <Skeleton height={80} />}
    {isError && <ErrorState error={error} />}
    {data && <form onSubmit={submit} className={styles.configForm}>
      <Input label="Acessos simultâneos (0 = sem limite)" type="number" min="0" max="500" required value={limite} onChange={e => setLimite(e.target.value)} />
      <Input label="Liberar vaga após inatividade (min)" type="number" min="1" max="240" required value={idle} onChange={e => setIdle(e.target.value)} />
      <div className={styles.configCheck}>
        <Checkbox label="Sessão única: novo login derruba o dispositivo anterior" checked={sessaoUnica} onChange={e => setSessaoUnica(e.target.checked)} />
      </div>
      <div className={styles.configFooter}>
        <span className={styles.muted}>Vale a partir do próximo login. Sessões abertas não são derrubadas.</span>
        <Button type="submit" size="sm" loading={mutation.isPending} disabled={!valido || !alterado}>Salvar regras</Button>
      </div>
    </form>}
  </Card>;
}

export function LicencasTab() {
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
    <section className={styles.heading}>
      <h2>Licenças e sessões</h2>
      <p>Defina o limite de acessos e veja quem está conectado agora. Derrubar libera a vaga na hora.</p>
    </section>
    <LicencaConfigCard />
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
