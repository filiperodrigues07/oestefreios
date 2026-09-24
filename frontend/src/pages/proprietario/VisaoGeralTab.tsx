import { useQuery } from '@tanstack/react-query';
import { getBilling } from '../../api/billing.api.js';
import { getLicenca } from '../../api/session.api.js';
import {
  ActionIcon,
  Avatar,
  Badge,
  Card,
  ErrorState,
  Skeleton,
} from '../../components/ui/index.js';
import { ESTADO_LABEL, ESTADO_TONE, dataBr, descricaoDias, moeda } from './AssinaturaTab.js';
import { tempoRelativo } from './LicencasTab.js';
import styles from './VisaoGeralTab.module.css';

const ESTADO_ICONE = { EM_DIA: '✓', A_VENCER: '!', VENCIDA: '!', SOMENTE_LEITURA: '⛔' } as const;

export function VisaoGeralTab({
  onIr,
}: {
  onIr: (
    tab: 'assinatura' | 'receber' | 'licencas',
    acao?: 'pagamento' | 'suspender' | 'liberar',
  ) => void;
}) {
  const billing = useQuery({ queryKey: ['billing'], queryFn: getBilling });
  const license = useQuery({ queryKey: ['license'], queryFn: getLicenca, refetchInterval: 30_000 });
  const online = (license.data?.usuarios ?? []).filter((u) => u.status !== 'offline');
  const b = billing.data;
  const l = license.data;
  const ratio = l && l.limite > 0 ? l.emUso / l.limite : 0;
  const licencaNivel = ratio >= 1 ? styles.medidorCheio : ratio >= 0.8 ? styles.medidorAtencao : '';

  return (
    <div className={styles.page}>
      <div className={styles.cards}>
        <Card elevated className={styles.card}>
          <span className={styles.label}>Assinatura</span>
          {billing.isLoading && <Skeleton height={64} />}
          {billing.isError && <ErrorState error={billing.error} />}
          {b && (
            <>
              <div className={styles.big}>
                <Badge tone={ESTADO_TONE[b.estado]}>
                  <span aria-hidden="true">{ESTADO_ICONE[b.estado]} </span>
                  {ESTADO_LABEL[b.estado]}
                </Badge>
                {b.origem === 'MANUAL' && <Badge tone="primary">Manual</Badge>}
              </div>
              <span className={styles.metricLabel}>Próximo vencimento</span>
              <strong className={styles.value}>{dataBr(b.vencimentoAtual)}</strong>
              <small>
                {descricaoDias(b.diasParaVencer)} · {moeda(b.valorMensal)}/mês
              </small>
            </>
          )}
        </Card>

        <Card elevated className={styles.card}>
          <span className={styles.label}>Licenças</span>
          {license.isLoading && <Skeleton height={64} />}
          {license.isError && <ErrorState error={license.error} />}
          {l && (
            <>
              <strong className={styles.value}>
                {l.limite === 0 ? `${l.emUso} em uso` : `${l.emUso} de ${l.limite}`}
              </strong>
              {l.limite > 0 && (
                <div
                  className={`${styles.medidor} ${licencaNivel}`}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={l.limite}
                  aria-valuenow={l.emUso}
                  aria-label="Vagas de licença ocupadas"
                >
                  <span style={{ width: `${Math.min(100, ratio * 100)}%` }} />
                </div>
              )}
              <small>
                {ratio >= 1
                  ? 'Todas as vagas ocupadas.'
                  : l.limite === 0
                    ? 'Sem limite configurado.'
                    : `${l.limite - l.emUso} vaga(s) livre(s).`}{' '}
                Inatividade de {l.idleMinutes} min libera a vaga.
              </small>
            </>
          )}
        </Card>

        <Card elevated className={styles.card}>
          <span className={styles.label}>Agora online</span>
          {license.isLoading && <Skeleton height={64} />}
          {license.isError && <small>Não foi possível carregar as sessões.</small>}
          {l &&
            (online.length === 0 ? (
              <small>Ninguém conectado.</small>
            ) : (
              <>
                <strong className={styles.onlineCount}>{online.length} conectado(s)</strong>
                <ul className={styles.online}>
                  {online.slice(0, 5).map((u) => (
                    <li key={u.id}>
                      <Avatar name={u.name} photoUrl={u.photoUrl ?? undefined} size={28} />
                      <span className={styles.onlineNome}>{u.name}</span>
                      <small>{tempoRelativo(u.lastSeenAt)}</small>
                    </li>
                  ))}
                </ul>
              </>
            ))}
          {online.length > 5 && <small>+{online.length - 5} conectado(s)</small>}
        </Card>
      </div>

      <section className={styles.actions} aria-label="Ações rápidas">
        <div className={styles.actionHeader}>
          <h3>Ações rápidas</h3>
          <p>Os caminhos mais usados, sem procurar pelas abas.</p>
        </div>
        <div className={styles.actionRow}>
          <button
            type="button"
            className={`${styles.actionTile} ${styles.actionPrimary}`}
            disabled={!b}
            onClick={() => onIr('receber')}
          >
            <span className={styles.actionIcon}>
              <ActionIcon name="receipt" size={21} />
            </span>
            <span className={styles.actionText}>
              <strong>Contas a receber</strong>
              <small>Boletos, envios e baixas</small>
            </span>
            <span className={styles.actionArrow} aria-hidden="true">
              →
            </span>
          </button>
          {b?.modo === 'SUSPENSO' ? (
            <button
              type="button"
              className={styles.actionTile}
              disabled={!b}
              onClick={() => onIr('assinatura', 'liberar')}
            >
              <span className={styles.actionIcon}>
                <ActionIcon name="ready" size={21} />
              </span>
              <span className={styles.actionText}>
                <strong>Liberar sistema</strong>
                <small>Reativar o acesso do cliente</small>
              </span>
              <span className={styles.actionArrow} aria-hidden="true">
                →
              </span>
            </button>
          ) : (
            <button
              type="button"
              className={styles.actionTile}
              disabled={!b}
              onClick={() => onIr('assinatura', 'suspender')}
            >
              <span className={styles.actionIcon}>
                <ActionIcon name="lock" size={21} />
              </span>
              <span className={styles.actionText}>
                <strong>Suspender acesso</strong>
                <small>Exige confirmação e motivo</small>
              </span>
              <span className={styles.actionArrow} aria-hidden="true">
                →
              </span>
            </button>
          )}
          <button type="button" className={styles.actionTile} onClick={() => onIr('licencas')}>
            <span className={styles.actionIcon}>
              <ActionIcon name="users" size={21} />
            </span>
            <span className={styles.actionText}>
              <strong>Licenças e sessões</strong>
              <small>Ver vagas e acessos</small>
            </span>
            <span className={styles.actionArrow} aria-hidden="true">
              →
            </span>
          </button>
        </div>
      </section>

      {b && (
        <Card elevated className={styles.recent}>
          <h3>Últimos pagamentos</h3>
          {b.pagamentos.length === 0 ? (
            <small>Nenhum pagamento registrado.</small>
          ) : (
            <ul>
              {b.pagamentos.slice(0, 3).map((p) => (
                <li key={p.id}>
                  <strong>{moeda(p.valor)}</strong>
                  <span>
                    ref. {p.referencia.split('-').reverse().join('/')} · {p.forma}
                  </span>
                  <small>pago em {dataBr(p.data)}</small>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
