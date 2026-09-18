import { useState } from 'react';
import { useNavigate } from 'react-router';
import { baixarOSPdf } from '../../api/os.api.js';
import { ActionIcon, Button, LinkButton, RefreshButton, useToast } from '../ui/index.js';
import { OS_PRIORITY_CONFIG, OS_STATUS_CONFIG } from '../../constants/osStatus.js';
import { ALLOWED_TRANSITIONS, type OSPrioridade, type OSStatus } from '../../types/os.types.js';
import { FinalizarOSButton } from './FinalizarOSButton.js';
import { OSFieldInfo } from './OSFieldInfo.js';
import styles from './OSFormHeader.module.css';

interface OSFormHeaderProps {
  id: string;
  numero: number;
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
}

export function OSFormHeader({
  id,
  numero,
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
}: OSFormHeaderProps) {
  const [nextStatus, setNextStatus] = useState(status);
  const [imprimindo, setImprimindo] = useState(false);
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
      <div className={styles.titleBlock}><div><h1>OS #{numero}</h1><span className={styles.badge}>{OS_STATUS_CONFIG[status].label}</span><time>▣ {new Date(dataAbertura).toLocaleString('pt-BR')}</time></div></div>
      <div className={styles.actions}>
        <Button type="button" variant="secondary" size="sm" onClick={handleVoltar}><ActionIcon name="back" />Voltar</Button>
        <Button type="button" variant="secondary" size="sm" onClick={handleImprimir} loading={imprimindo}><ActionIcon name="print" />{imprimindo ? 'Gerando PDF...' : 'Imprimir'}</Button>
        <RefreshButton onClick={onRefresh} loading={refreshing} />
        {canChangeStatus && <Button type="button" size="sm" disabled={updating || nextStatus === status} onClick={() => onStatusChange(nextStatus)}><ActionIcon name="update" />Atualizar status</Button>}
        {canChangeStatus && status !== 'CONCLUIDA' && status !== 'CANCELADA' && <FinalizarOSButton onConfirm={onFinalizar} loading={finalizando} />}
      </div>
    </div>
    <div className={styles.summaryGrid}>
      <div className={styles.selectBox}><OSFieldInfo field="status">Status da OS</OSFieldInfo><select value={nextStatus} disabled={!canChangeStatus || updating} onChange={(event) => setNextStatus(event.target.value as OSStatus)}>{transitions.map((value) => <option key={value} value={value}>{OS_STATUS_CONFIG[value].label}</option>)}</select></div>
      <div className={styles.selectBox}><OSFieldInfo field="prioridade">Prioridade</OSFieldInfo><select value={prioridade} disabled={!canEdit || updating} onChange={(event) => onPriorityChange(event.target.value as OSPrioridade)}>{(Object.keys(OS_PRIORITY_CONFIG) as OSPrioridade[]).filter((value) => value !== 'URGENTE').map((value) => <option key={value} value={value}>{OS_PRIORITY_CONFIG[value].label}</option>)}</select></div>
    </div>
  </header>;
}
