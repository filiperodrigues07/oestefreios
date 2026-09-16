import { useState } from 'react';
import { LinkButton } from '../ui/index.js';
import { OS_PRIORITY_CONFIG, OS_STATUS_CONFIG } from '../../constants/osStatus.js';
import { ALLOWED_TRANSITIONS, type OSPrioridade, type OSStatus } from '../../types/os.types.js';
import { OSFieldInfo } from './OSFieldInfo.js';
import styles from './OSFormHeader.module.css';

interface OSFormHeaderProps { numero: number; status: OSStatus; prioridade: OSPrioridade; dataAbertura: string; onRefresh: () => void; refreshing: boolean; canChangeStatus: boolean; canEdit: boolean; onStatusChange: (status: OSStatus) => void; onPriorityChange: (priority: OSPrioridade) => void; updating: boolean; }

export function OSFormHeader({ numero, status, prioridade, dataAbertura, onRefresh, refreshing, canChangeStatus, canEdit, onStatusChange, onPriorityChange, updating }: OSFormHeaderProps) {
  const [nextStatus, setNextStatus] = useState(status);
  const transitions = [status, ...ALLOWED_TRANSITIONS[status]];
  return <header className={styles.header}>
    <div className={styles.breadcrumb}><LinkButton to="/os" variant="ghost" size="sm">‹ Ordem de Serviço</LinkButton><span>›</span><strong>OS #{numero}</strong></div>
    <div className={styles.row}>
      <div className={styles.titleBlock}><div><h1>OS #{numero}</h1><span className={styles.badge}>{OS_STATUS_CONFIG[status].label}</span><time>▣ {new Date(dataAbertura).toLocaleString('pt-BR')}</time></div></div>
      <div className={styles.actions}><LinkButton to="/os" size="sm" variant="secondary">Voltar</LinkButton><button type="button" className={styles.secondary} onClick={onRefresh} disabled={refreshing}>{refreshing ? 'Atualizando...' : 'Mais ações ⌄'}</button>{canChangeStatus && <button type="button" className={styles.primary} disabled={updating || nextStatus === status} onClick={() => onStatusChange(nextStatus)}>Atualizar status</button>}</div>
    </div>
    <div className={styles.summaryGrid}>
      <div className={styles.selectBox}><OSFieldInfo field="status">Status da OS</OSFieldInfo><select value={nextStatus} disabled={!canChangeStatus || updating} onChange={(event) => setNextStatus(event.target.value as OSStatus)}>{transitions.map((value) => <option key={value} value={value}>{OS_STATUS_CONFIG[value].label}</option>)}</select></div>
      <div className={styles.selectBox}><OSFieldInfo field="prioridade">Prioridade</OSFieldInfo><select value={prioridade} disabled={!canEdit || updating} onChange={(event) => onPriorityChange(event.target.value as OSPrioridade)}>{(Object.keys(OS_PRIORITY_CONFIG) as OSPrioridade[]).map((value) => <option key={value} value={value}>{OS_PRIORITY_CONFIG[value].label}</option>)}</select></div>
    </div>
  </header>;
}
