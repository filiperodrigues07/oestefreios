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

/**
 * Situação de atendimento nativa do CHERP (TABELAS grupo 15). É o valor real de lá: inclui Pronta,
 * Entregue e Encerrada marcadas direto no CHERP. "Finalizar OS" no app grava Pronta.
 */
export const SITUACAO_ATENDIMENTO_CONFIG: Record<string, OSStatusConfig> = {
  '000001': { label: 'Em atendimento', tone: 'info' },
  '000002': { label: 'Aguardando ret. cliente', tone: 'warning' },
  '000003': { label: 'Aguardando peças', tone: 'warning' },
  '000004': { label: 'Pronta', tone: 'success' },
  '000005': { label: 'Entregue', tone: 'primary' },
  '000006': { label: 'Encerrada', tone: 'neutral' },
};

/** Rótulo curto pra coluna da lista (o completo vai no title); tabela com muitas colunas em 1366px. */
export const SITUACAO_ATENDIMENTO_CURTA: Record<string, string> = {
  '000001': 'Em atendimento',
  '000002': 'Ag. retorno',
  '000003': 'Ag. peças',
  '000004': 'Pronta',
  '000005': 'Entregue',
  '000006': 'Encerrada',
};

export const SITUACAO_ATENDIMENTO_OPTIONS = Object.entries(SITUACAO_ATENDIMENTO_CONFIG).map(([value, config]) => ({ value, label: config.label }));

/** Valor do filtro de Situação para "finalizadas no app" (não é uma SITUACAO do CHERP). */
export const SITUACAO_FINALIZADA_APP = 'app';

const FINALIZADA_APP: OSStatusConfig = { label: 'Finalizada no app', tone: 'success' };

/**
 * Situação exibida na lista: OS travada pelo app ("Finalizar OS") e ainda em aberto no CHERP aparece
 * como "Finalizada no app" — distinta de pedido/NF gerado no CHERP (faturada de verdade).
 */
export function situacaoDaOS(os: { situacaoDocumento?: number; travadoLocal?: boolean }): OSStatusConfig | undefined {
  if (os.travadoLocal && (os.situacaoDocumento ?? 0) === 0) return FINALIZADA_APP;
  return os.situacaoDocumento === undefined ? undefined : OS_DOCUMENT_STATUS_CONFIG[os.situacaoDocumento];
}

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
  NORMAL: { label: 'Normal', tone: 'success' },
  BAIXA: { label: 'Baixa', tone: 'warning' },
  MEDIA: { label: 'Média', tone: 'warning' },
  ALTA: { label: 'Alta', tone: 'danger' },
  URGENTE: { label: 'Alta', tone: 'danger' },
};

const PRIORIDADE_ORDEM: OSPrioridade[] = ['NORMAL', 'BAIXA', 'MEDIA', 'ALTA'];

/** Opções pra Select de prioridade — mesma fonte de rótulo do badge, sem duplicar em cada tela. */
export const OS_PRIORIDADE_OPTIONS = PRIORIDADE_ORDEM.map((value) => ({ value, label: OS_PRIORITY_CONFIG[value].label }));
