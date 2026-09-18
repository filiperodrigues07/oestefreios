import type { BadgeTone } from '../components/ui/Badge.js';
import type { OSPrioridade, OSStatus } from '../types/os.types.js';

export type { OSStatus };

interface OSStatusConfig {
  label: string;
  tone: BadgeTone;
}

export const OS_DOCUMENT_STATUS_CONFIG: Record<number, OSStatusConfig> = {
  0: { label: 'Aberta', tone: 'info' },
  1: { label: 'Gerado Ped.', tone: 'warning' },
  2: { label: 'Gerado CF', tone: 'warning' },
  3: { label: 'Gerado NF', tone: 'success' },
  4: { label: 'Encerrada', tone: 'neutral' },
  5: { label: 'Agrupada', tone: 'primary' },
  6: { label: 'Estornada', tone: 'danger' },
};

export const OS_DOCUMENT_STATUS_OPTIONS = Object.entries(OS_DOCUMENT_STATUS_CONFIG).map(([value, config]) => ({ value, label: config.label }));

/** Fonte única da verdade para rótulo + cor semântica de cada status de OS. */
export const OS_STATUS_CONFIG: Record<OSStatus, OSStatusConfig> = {
  ABERTA: { label: 'Em atendimento', tone: 'info' },
  EM_ANALISE: { label: 'Em atendimento', tone: 'info' },
  EM_ANDAMENTO: { label: 'Em atendimento', tone: 'info' },
  AGUARDANDO_PECA: { label: 'Aguardando peças', tone: 'warning' },
  AGUARDANDO_CLIENTE: { label: 'Aguardando ret. cliente', tone: 'warning' },
  CONCLUIDA: { label: 'Pronta', tone: 'success' },
  CANCELADA: { label: 'Encerrada', tone: 'danger' },
};

/**
 * Status "em aberto" — os únicos que a listagem de OS mostra (backend nunca traz
 * concluída/cancelada na lista, ver OSRepository.firebird.ts). Usado pro filtro da tela.
 */
export const OS_STATUS_ABERTOS: OSStatus[] = [
  'ABERTA',
  'AGUARDANDO_PECA',
  'AGUARDANDO_CLIENTE',
  'CONCLUIDA',
  'CANCELADA',
];

export const OS_PRIORITY_CONFIG: Record<OSPrioridade, OSStatusConfig> = {
  BAIXA: { label: 'Baixa', tone: 'neutral' },
  NORMAL: { label: 'Normal', tone: 'info' },
  MEDIA: { label: 'Média', tone: 'primary' },
  ALTA: { label: 'Alta', tone: 'warning' },
  URGENTE: { label: 'Alta', tone: 'warning' },
};

const PRIORIDADE_ORDEM: OSPrioridade[] = ['BAIXA', 'NORMAL', 'MEDIA', 'ALTA'];

/** Opções pra Select de prioridade — mesma fonte de rótulo do badge, sem duplicar em cada tela. */
export const OS_PRIORIDADE_OPTIONS = PRIORIDADE_ORDEM.map((value) => ({ value, label: OS_PRIORITY_CONFIG[value].label }));
