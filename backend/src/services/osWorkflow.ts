import { ValidationError } from '../errors/ValidationError.js';
import type { OSStatus } from '../types/cherp.types.js';

/**
 * Transições de status permitidas (seção 17 do briefing). Validado sempre no
 * backend — nunca confiar apenas no frontend para decidir se uma mudança é válida.
 */
const ALLOWED_TRANSITIONS: Record<OSStatus, OSStatus[]> = {
  ABERTA: ['EM_ANALISE', 'CANCELADA'],
  EM_ANALISE: ['EM_ANDAMENTO', 'ABERTA', 'CANCELADA'],
  EM_ANDAMENTO: ['AGUARDANDO_PECA', 'AGUARDANDO_CLIENTE', 'CONCLUIDA', 'CANCELADA'],
  AGUARDANDO_PECA: ['EM_ANDAMENTO', 'CANCELADA'],
  AGUARDANDO_CLIENTE: ['EM_ANDAMENTO', 'CANCELADA'],
  CONCLUIDA: [],
  CANCELADA: [],
};

export function assertValidTransition(current: OSStatus, next: OSStatus) {
  if (current === next) {
    throw new ValidationError(`OS já está no status "${next}".`);
  }
  if (!ALLOWED_TRANSITIONS[current].includes(next)) {
    throw new ValidationError(
      `Transição de status inválida: "${current}" → "${next}". Permitido a partir de "${current}": ${
        ALLOWED_TRANSITIONS[current].join(', ') || 'nenhuma (status final)'
      }.`,
    );
  }
}
