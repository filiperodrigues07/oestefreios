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

export const OS_PRIORITY_CONFIG: Record<OSPrioridade, OSStatusConfig> = {
  BAIXA: { label: 'Baixa', tone: 'neutral' },
  NORMAL: { label: 'Normal', tone: 'info' },
  ALTA: { label: 'Alta', tone: 'warning' },
  URGENTE: { label: 'Urgente', tone: 'danger' },
};
