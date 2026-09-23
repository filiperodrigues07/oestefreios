import { useState } from 'react';
import { useNavigate } from 'react-router';
import { baixarOSPdf } from '../../api/os.api.js';
import { ActionIcon, Button, ConfirmDialog, LinkButton, PriorityBadge, ReasonDialog, RefreshButton, useToast } from '../ui/index.js';
import { OS_PRIORITY_CONFIG, OS_STATUS_CONFIG } from '../../constants/osStatus.js';
import { ALLOWED_TRANSITIONS, type OSPrioridade, type OSStatus } from '../../types/os.types.js';
import { FinalizarOSButton } from './FinalizarOSButton.js';
import { OSFieldInfo } from './OSFieldInfo.js';
import styles from './OSFormHeader.module.css';

interface OSFormHeaderProps {
  id: string;
  numero: number;
  nroDav?: string;
  status: OSStatus;
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
  onDuplicar: () => void;
  duplicando: boolean;
  /** Já considera permissão OS_DELETE e OS aberta (finalizada/com pedido não pode ser excluída). */
  canDelete: boolean;
  onExcluir: (motivo: string) => void;
  excluindo: boolean;
}

export function OSFormHeader({
  id,
  numero,
  nroDav,
  status,
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
}: OSFormHeaderProps) {
  const [nextStatus, setNextStatus] = useState(status);
  const [imprimindo, setImprimindo] = useState(false);
  const [confirmandoDuplicar, setConfirmandoDuplicar] = useState(false);
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const transitions = [status, ...ALLOWED_TRANSITIONS[status]];

  function handleVoltar() {
    showToast('OS salva com sucesso.', 'success');
    navigate('/os');
  }

  async function handleImprimir() {
    setImprimindo(true);
    try {
      await baixarOSPdf(id, numero);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível gerar o PDF.', 'danger');
    } finally {
      setImprimindo(false);
    }
  }

  return <header className={styles.header}>
    <div className={styles.breadcrumb}><LinkButton to="/os" variant="ghost" size="sm">‹ Ordem de Serviço</LinkButton><span>›</span><strong>OS #{numero}</strong></div>
    <div className={styles.row}>
      <div className={styles.titleBlock}>
        <div className={styles.titleLine}>
          <h1>OS #{numero}</h1>
          <span className={styles.badge}>{OS_STATUS_CONFIG[status].label}</span>
          <PriorityBadge priority={prioridade} />
        </div>
        <div className={styles.metaLine}>
          {nroDav && <span className={styles.dav}>DAV Nº <strong>{nroDav}</strong></span>}
          <time>{new Date(dataAbertura).toLocaleString('pt-BR')}</time>
        </div>
      </div>
      <div className={styles.actions}>
        <Button type="button" variant="secondary" size="sm" onClick={handleVoltar}><ActionIcon name="back" />Voltar</Button>
        <Button type="button" variant="secondary" size="sm" onClick={handleImprimir} loading={imprimindo}><ActionIcon name="print" />{imprimindo ? 'Gerando PDF...' : 'Imprimir'}</Button>
        <RefreshButton onClick={onRefresh} loading={refreshing} label="Recarregar dados" />
        {canChangeStatus && <Button type="button" size="sm" disabled={updating || nextStatus === status} onClick={() => onStatusChange(nextStatus)} title="Gravar a situação selecionada no CHERP"><ActionIcon name="save" />Salvar situação</Button>}
        {canChangeStatus && status !== 'CONCLUIDA' && status !== 'CANCELADA' && <FinalizarOSButton onConfirm={onFinalizar} loading={finalizando} />}
        {canDuplicate && <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmandoDuplicar(true)} loading={duplicando} title="Criar uma OS nova com os mesmos dados"><ActionIcon name="copy" />Duplicar</Button>}
        {canDelete && <Button type="button" variant="destructive" size="sm" onClick={() => setConfirmandoExcluir(true)} loading={excluindo}><ActionIcon name="delete" />Excluir</Button>}
      </div>
    </div>
    <div className={styles.summaryGrid}>
      <div className={styles.selectBox}><OSFieldInfo field="status">Sit. atendimento</OSFieldInfo><select value={nextStatus} disabled={!canChangeStatus || updating} onChange={(event) => setNextStatus(event.target.value as OSStatus)}>{transitions.map((value) => <option key={value} value={value}>{OS_STATUS_CONFIG[value].label}</option>)}</select></div>
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
    <ConfirmDialog
      open={confirmandoDuplicar}
      title={`Duplicar OS #${numero}?`}
      description="Será criada uma OS nova e aberta, com número e DAV próprios, copiando cliente, veículo, problema, prioridade, produtos, serviços e diagnóstico. A OS atual não é alterada."
      confirmLabel="Duplicar"
      loading={duplicando}
      onCancel={() => setConfirmandoDuplicar(false)}
      onConfirm={() => {
        setConfirmandoDuplicar(false);
        onDuplicar();
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
