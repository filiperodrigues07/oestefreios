import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { getBilling } from '../../api/billing.api.js';
import { ActionIcon, Card, ErrorState, Skeleton } from '../../components/ui/index.js';
import type { CobrancaDTO } from '../../types/billing.types.js';
import { PagamentoModal } from './AssinaturaTab.js';
import { CobrancasCard } from './CobrancasCard.js';
import { hojeLocal, moeda } from './formatos.js';
import styles from './ContasReceberTab.module.css';

export function ContasReceberTab() {
  const [pagamento, setPagamento] = useState<CobrancaDTO | null>(null);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['billing'],
    queryFn: getBilling,
  });
  const abertas = data?.cobrancas.filter((item) => !item.pagoEm) ?? [];
  const vencidas = abertas.filter((item) => item.vencimento < hojeLocal());
  const recebidas = data?.cobrancas.filter((item) => Boolean(item.pagoEm)) ?? [];
  const valorAberto = abertas.reduce((total, item) => total + item.valor, 0);

  return (
    <section className={styles.page} aria-label="Contas a receber">
      <div className={styles.intro}>
        <div className={styles.introIcon}>
          <ActionIcon name="receipt" size={25} />
        </div>
        <div className={styles.introText}>
          <h2>Contas a receber</h2>
          <p>
            Organize os boletos da mensalidade, envie o PDF por e-mail e registre as baixas
            manualmente.
          </p>
        </div>
      </div>

      {isLoading && <Skeleton height={190} />}
      {isError && <ErrorState error={error} />}
      {data && (
        <>
          <div className={styles.metrics}>
            <Card className={styles.metric}>
              <span className={styles.metricIcon}>
                <ActionIcon name="receipt" size={20} />
              </span>
              <span className={styles.metricLabel}>Em aberto</span>
              <strong>{moeda(valorAberto)}</strong>
              <small>
                {abertas.length} cobrança{abertas.length === 1 ? '' : 's'} pendente
                {abertas.length === 1 ? '' : 's'}
              </small>
            </Card>
            <Card className={`${styles.metric} ${styles.overdue}`}>
              <span className={styles.metricIcon}>
                <ActionIcon name="calendar" size={20} />
              </span>
              <span className={styles.metricLabel}>Vencidas</span>
              <strong>{vencidas.length}</strong>
              <small>
                {vencidas.length
                  ? moeda(vencidas.reduce((total, item) => total + item.valor, 0)) + ' pendentes'
                  : 'Nenhuma cobrança vencida'}
              </small>
            </Card>
            <Card className={`${styles.metric} ${styles.received}`}>
              <span className={styles.metricIcon}>
                <ActionIcon name="ready" size={20} />
              </span>
              <span className={styles.metricLabel}>Recebidas</span>
              <strong>{recebidas.length}</strong>
              <small>Baixas registradas manualmente</small>
            </Card>
          </div>

          <div className={styles.workflow} aria-label="Como usar">
            <span>
              <ActionIcon name="pdf" /> 1. Anexe o boleto
            </span>
            <span>
              <ActionIcon name="mail" /> 2. Envie por e-mail
            </span>
            <span>
              <ActionIcon name="ready" /> 3. Registre o pagamento
            </span>
          </div>

          <CobrancasCard billing={data} onPagar={setPagamento} />
        </>
      )}
      {data && pagamento && (
        <PagamentoModal
          billing={data}
          cobranca={pagamento}
          onClose={() => setPagamento(null)}
        />
      )}
    </section>
  );
}
