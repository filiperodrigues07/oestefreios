import { useQuery } from '@tanstack/react-query';
import { getSistemaStatus, type SistemaStatus } from '../../api/settings.api.js';
import { Badge, Button, Card, ErrorState, Skeleton, type BadgeTone } from '../../components/ui/index.js';
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';
import { usePendingOperations } from '../../hooks/usePendingOperations.js';
import { APP_VERSION } from '../../utils/appVersion.js';
import styles from './SistemaTab.module.css';

/** Backup diário: passou de um dia e meio sem registro, algo parou. */
const HORAS_BACKUP_ATRASADO = 36;

function descreverComponente(valor: 'ok' | 'down' | 'mock'): { tom: BadgeTone; texto: string } {
  if (valor === 'ok') return { tom: 'success', texto: 'Funcionando' };
  if (valor === 'mock') return { tom: 'neutral', texto: 'Modo demonstração' };
  return { tom: 'danger', texto: 'Fora do ar' };
}

function descreverBackup(backup: SistemaStatus['backup']): { tom: BadgeTone; texto: string; detalhe: string } {
  if (!backup) {
    return { tom: 'warning', texto: 'Sem registro', detalhe: 'Nenhum backup registrado neste servidor.' };
  }
  const horas = (Date.now() - new Date(backup.finishedAt).getTime()) / 3_600_000;
  const quando = new Date(backup.finishedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const copia =
    backup.remote === true ? ' Cópia externa enviada.' : backup.remote === false ? ' Cópia externa falhou.' : '';
  const detalhe = `Último backup: ${quando}.${copia}`;
  if (horas > HORAS_BACKUP_ATRASADO || backup.remote === false) return { tom: 'danger', texto: 'Atrasado', detalhe };
  return { tom: 'success', texto: 'Em dia', detalhe };
}

function formatarTempoNoAr(segundos: number): string {
  const dias = Math.floor(segundos / 86_400);
  const horas = Math.floor((segundos % 86_400) / 3600);
  if (dias > 0) return `${dias}d ${horas}h`;
  return `${horas}h ${Math.floor((segundos % 3600) / 60)}min`;
}

/**
 * Painel de saúde pro administrador do cliente: mostra na hora se o problema é do CHERP (Firebird
 * desligado), da internet do aparelho ou do servidor — antes de abrir chamado.
 */
export function SistemaTab() {
  const online = useOnlineStatus();
  const { operations: pendentes } = usePendingOperations();
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['settings', 'sistema'],
    queryFn: getSistemaStatus,
    refetchInterval: 30_000,
    staleTime: 0,
  });

  if (isLoading) return <Skeleton height={220} />;
  if (isError || !data) {
    return <ErrorState error={error} action={<Button onClick={() => refetch()}>Tentar novamente</Button>} />;
  }

  const firebird = descreverComponente(data.firebird);
  const postgres = descreverComponente(data.postgres);
  const backup = descreverBackup(data.backup);

  return (
    <section aria-labelledby="sistema-titulo">
      <div className={styles.header}>
        <div>
          <h2 id="sistema-titulo">Saúde do sistema</h2>
          <p>Atualiza sozinho a cada 30 segundos.</p>
        </div>
        <Button size="sm" variant="secondary" loading={isFetching} onClick={() => refetch()}>
          Verificar agora
        </Button>
      </div>

      <div className={styles.grid}>
        <Card className={styles.item}>
          <h3>CHERP (Firebird)</h3>
          <Badge tone={firebird.tom}>{firebird.texto}</Badge>
          {data.firebird === 'down' && (
            <p>OS, clientes e produtos não carregam. Confira se o servidor do CHERP está ligado e com rede.</p>
          )}
        </Card>

        <Card className={styles.item}>
          <h3>Banco do aplicativo</h3>
          <Badge tone={postgres.tom}>{postgres.texto}</Badge>
          {data.postgres === 'down' && <p>Login e sessões não funcionam. Avise o suporte.</p>}
        </Card>

        <Card className={styles.item}>
          <h3>Backup</h3>
          <Badge tone={backup.tom}>{backup.texto}</Badge>
          <p>{backup.detalhe}</p>
        </Card>

        <Card className={styles.item}>
          <h3>Este aparelho</h3>
          <Badge tone={online ? 'success' : 'danger'}>{online ? 'Conectado' : 'Sem internet'}</Badge>
          <p>
            {pendentes.length === 0
              ? 'Nenhuma alteração aguardando sincronização.'
              : `${pendentes.length} alteração(ões) aguardando internet para sincronizar.`}
          </p>
        </Card>

        <Card className={styles.item}>
          <h3>Usuários conectados</h3>
          <span className={styles.value}>{data.sessoesAtivas}</span>
        </Card>

        <Card className={styles.item}>
          <h3>Versão</h3>
          <p>
            Aplicativo: <strong>{APP_VERSION}</strong>
            <br />
            Servidor: <strong>{data.version}</strong> · no ar há {formatarTempoNoAr(data.uptimeSegundos)}
          </p>
        </Card>
      </div>
    </section>
  );
}
