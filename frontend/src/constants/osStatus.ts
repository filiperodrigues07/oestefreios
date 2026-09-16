import type { BadgeTone } from '../components/ui/Badge.js';
import type { OSPrioridade, OSStatus } from '../types/os.types.js';

export type { OSStatus };

interface OSStatusConfig {
  label: string;
  tone: BadgeTone;
}

/** Fonte única da verdade para rótulo + cor semântica de cada status de OS. */
export const OS_STATUS_CONFIG: Record<OSStatus, OSStatusConfig> = {
  ABERTA: { label: 'Aberta', tone: 'info' },
  EM_ANALISE: { label: 'Em análise', tone: 'neutral' },
  EM_ANDAMENTO: { label: 'Em andamento', tone: 'primary' },
  AGUARDANDO_PECA: { label: 'Aguardando peça', tone: 'warning' },
  AGUARDANDO_CLIENTE: { label: 'Aguardando cliente', tone: 'warning' },
  CONCLUIDA: { label: 'Concluída', tone: 'success' },
  CANCELADA: { label: 'Cancelada', tone: 'danger' },
};

/**
 * Status "em aberto" — os únicos que a listagem de OS mostra (backend nunca traz
 * concluída/cancelada na lista, ver OSRepository.firebird.ts). Usado pro filtro da tela.
 */
export const OS_STATUS_ABERTOS: OSStatus[] = [
  'ABERTA',
  'EM_ANALISE',
  'EM_ANDAMENTO',
  'AGUARDANDO_PECA',
  'AGUARDANDO_CLIENTE',
];

export const OS_PRIORITY_CONFIG: Record<OSPrioridade, OSStatusConfig> = {
  BAIXA: { label: 'Baixa', tone: 'neutral' },
  NORMAL: { label: 'Normal', tone: 'info' },
  ALTA: { label: 'Alta', tone: 'warning' },
  URGENTE: { label: 'Urgente', tone: 'danger' },
};

const PRIORIDADE_ORDEM: OSPrioridade[] = ['BAIXA', 'NORMAL', 'ALTA', 'URGENTE'];

/** Opções pra Select de prioridade — mesma fonte de rótulo do badge, sem duplicar em cada tela. */
export const OS_PRIORIDADE_OPTIONS = PRIORIDADE_ORDEM.map((value) => ({ value, label: OS_PRIORITY_CONFIG[value].label }));
