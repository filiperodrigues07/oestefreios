import { useState } from 'react';
import { ActionIcon, Button, LinkButton, PriorityBadge, ReasonDialog } from '../ui/index.js';
import { OS_PRIORITY_CONFIG, OS_STATUS_CONFIG, SITUACAO_ATENDIMENTO_CONFIG } from '../../constants/osStatus.js';
import { ALLOWED_TRANSITIONS, type OSPrioridade, type OSStatus } from '../../types/os.types.js';
import { FinalizarOSButton } from './FinalizarOSButton.js';
import { OSMoreActions, type MoreActionItem } from './OSMoreActions.js';
import { OSFieldInfo } from './OSFieldInfo.js';
import { OSDuplicateDialog, type OSKmInput } from './OSDuplicateDialog.js';
import { OSPdfPreview } from './OSPdfPreview.js';
import styles from './OSFormHeader.module.css';

interface OSFormHeaderProps {
  id: string;
  numero: number;
  nroDav?: string;
  status: OSStatus;
  /** Situação de atendimento real do CHERP — Pronta/Entregue/Encerrada marcadas lá não têm status próprio no app. */
  situacaoAtendimentoCodigo?: string;
  prioridade: OSPrioridade;
  dataAbertura: string;
  onRefresh: () => void;
  refreshing: boolean;
  canChangeStatus: boolean;
  canEdit: boolean;
  onStatusChange: (status: OSStatus) => void;
  onPriorityChange: (priority: OSPrioridade) => void;
  onFinalizar: () => void;
  finalizando: boolean;
  updating: boolean;
  canDuplicate: boolean;
  onDuplicar: (km: OSKmInput) => void;
  duplicando: boolean;
  /** Já considera permissão OS_DELETE e OS aberta (finalizada/com pedido não pode ser excluída). */
  canDelete: boolean;
  onExcluir: (motivo: string) => void;
  excluindo: boolean;
  /** Já considera permissão OS_REOPEN e trava só do app (OS com pedido/NF no CHERP não reabre por aqui). */
  canReopen: boolean;
  onReabrir: (motivo: string) => void;
  reabrindo: boolean;
  /** Abre o envio da OS ao cliente; ausente quando o usuário não pode enviar. */
  onEnviar?: (canal: 'whatsapp' | 'email') => void;
}

export function OSFormHeader({
  id,
  numero,
  nroDav,
  status,
  situacaoAtendimentoCodigo,
  prioridade,
  dataAbertura,
  onRefresh,
  refreshing,
  canChangeStatus,
  canEdit,
  onStatusChange,
  onPriorityChange,
  onFinalizar,
  finalizando,
  updating,
  canDuplicate,
  onDuplicar,
  duplicando,
  canDelete,
  onExcluir,
  excluindo,
  canReopen,
  onReabrir,
  reabrindo,
  onEnviar,
}: OSFormHeaderProps) {
  const [confirmandoReabrir, setConfirmandoReabrir] = useState(false);
  const cherpDizMais = situacaoAtendimentoCodigo === '000004' || situacaoAtendimentoCodigo === '000005' || situacaoAtendimentoCodigo === '000006';
  const rotuloStatus = cherpDizMais ? SITUACAO_ATENDIMENTO_CONFIG[situacaoAtendimentoCodigo!]!.label : OS_STATUS_CONFIG[status].label;
  const [imprimindo, setImprimindo] = useState(false);
  const [confirmandoDuplicar, setConfirmandoDuplicar] = useState(false);
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false);
  const transitions = [status, ...ALLOWED_TRANSITIONS[status]];


  // Imprimir e mandar pro cliente num botão só: a barra não cresce com os canais de envio.
  const enviarItems: MoreActionItem[] = [
    { key: 'print', label: 'Visualizar / baixar PDF', icon: 'print', disabled: imprimindo, onSelect: () => setImprimindo(true) },
    ...(onEnviar ? [
      { key: 'whatsapp', label: 'Enviar por WhatsApp', icon: 'whatsapp' as const, onSelect: () => onEnviar('whatsapp') },
      { key: 'email', label: 'Enviar por e-mail', icon: 'mail' as const, onSelect: () => onEnviar('email') },
    ] : []),
  ];

  const moreItems: MoreActionItem[] = [
    { key: 'refresh', label: 'Recarregar dados', icon: 'update', disabled: refreshing, onSelect: onRefresh },
    ...(canDuplicate ? [{ key: 'duplicate', label: 'Duplicar OS', icon: 'copy' as const, disabled: duplicando, onSelect: () => setConfirmandoDuplicar(true) }] : []),
    ...(canDelete ? [{ key: 'delete', label: 'Excluir OS', icon: 'delete' as const, danger: true, disabled: excluindo, onSelect: () => setConfirmandoExcluir(true) }] : []),
  ];

  return <header className={styles.header}>
    <div className={styles.breadcrumb}><LinkButton to="/os" variant="ghost" size="sm">‹ Ordem de Serviço</LinkButton><span>›</span><strong>OS #{numero}</strong></div>
    <div className={styles.row}>
      <div className={styles.titleBlock}>
        <div className={styles.titleLine}>
          <h1>OS #{numero}</h1>
          <span className={styles.badge}>{rotuloStatus}</span>
          <PriorityBadge priority={prioridade} />
        </div>
        <div className={styles.metaLine}>
          {nroDav && <span className={styles.dav}>DAV Nº <strong>{nroDav}</strong></span>}
          <time>{new Date(dataAbertura).toLocaleString('pt-BR')}</time>
        </div>
      </div>
      <div className={styles.actions}>
        {canChangeStatus && status !== 'CONCLUIDA' && status !== 'CANCELADA' && <div className={styles.finalizeAction}><FinalizarOSButton onConfirm={onFinalizar} loading={finalizando} /></div>}
        {canReopen && <Button type="button" size="sm" loading={reabrindo} onClick={() => setConfirmandoReabrir(true)}><ActionIcon name="update" />Reabrir OS</Button>}
        <OSMoreActions items={enviarItems} loading={imprimindo} label={onEnviar ? 'Imprimir / Enviar' : 'Imprimir'} icon="print" className={`${styles.actionMenu} ${styles.sendMenu}`} />
        <OSMoreActions items={moreItems} loading={refreshing || duplicando || excluindo} className={styles.actionMenu} />
      </div>
    </div>
    <div className={styles.summaryGrid}>
      <div className={styles.selectBox}><OSFieldInfo field="status">Sit. atendimento</OSFieldInfo><select value={status} disabled={!canChangeStatus || updating} onChange={(event) => onStatusChange(event.target.value as OSStatus)}>{transitions.map((value) => <option key={value} value={value}>{OS_STATUS_CONFIG[value].label}</option>)}</select></div>
      <div className={styles.selectBox}>
        <OSFieldInfo field="prioridade">Prioridade</OSFieldInfo>
        <div className={styles.priorityControl} data-priority={prioridade}>
          <span className={styles.priorityDot} aria-hidden="true" />
          <select value={prioridade} disabled={!canEdit || updating} onChange={(event) => onPriorityChange(event.target.value as OSPrioridade)}>
            {(Object.keys(OS_PRIORITY_CONFIG) as OSPrioridade[]).filter((value) => value !== 'URGENTE').map((value) => <option key={value} value={value}>{OS_PRIORITY_CONFIG[value].label}</option>)}
          </select>
        </div>
      </div>
    </div>
    <OSDuplicateDialog numero={numero} open={confirmandoDuplicar} loading={duplicando}
      onCancel={() => setConfirmandoDuplicar(false)} onConfirm={onDuplicar} />
    <OSPdfPreview os={imprimindo ? { id, numero } : null} onClose={() => setImprimindo(false)} />
    <ReasonDialog
      open={confirmandoReabrir}
      title={`Reabrir OS #${numero}?`}
      description="A OS volta para Em atendimento e pode ser editada de novo. O motivo fica no histórico da OS e na auditoria."
      reasonLabel="Motivo da reabertura"
      confirmLabel="Reabrir OS"
      loading={reabrindo}
      onCancel={() => setConfirmandoReabrir(false)}
      onConfirm={(motivo) => {
        setConfirmandoReabrir(false);
        onReabrir(motivo);
      }}
    />
    <ReasonDialog
      open={confirmandoExcluir}
      title={`Excluir OS #${numero}?`}
      description="A OS inteira será removida do sistema e do CHERP. Só OS em aberto pode ser excluída."
      reasonLabel="Motivo da exclusão"
      confirmLabel="Excluir OS"
      loading={excluindo}
      onCancel={() => setConfirmandoExcluir(false)}
      onConfirm={(motivo) => onExcluir(motivo)}
    />
  </header>;
}
