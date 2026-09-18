import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../errors/ValidationError.js';
import { assertValidTransition } from '../osWorkflow.js';

describe('workflow de status da OS (seção 17)', () => {
  it('permite transições do fluxo principal', () => {
    expect(() => assertValidTransition('ABERTA', 'AGUARDANDO_PECA')).not.toThrow();
    expect(() => assertValidTransition('AGUARDANDO_PECA', 'ABERTA')).not.toThrow();
    expect(() => assertValidTransition('ABERTA', 'CONCLUIDA')).not.toThrow();
  });

  it('permite os desvios documentados (aguardando peça/cliente e volta)', () => {
    expect(() => assertValidTransition('ABERTA', 'AGUARDANDO_PECA')).not.toThrow();
    expect(() => assertValidTransition('AGUARDANDO_PECA', 'ABERTA')).not.toThrow();
    expect(() => assertValidTransition('ABERTA', 'AGUARDANDO_CLIENTE')).not.toThrow();
    expect(() => assertValidTransition('AGUARDANDO_CLIENTE', 'ABERTA')).not.toThrow();
  });

  it('rejeita pular etapas (ABERTA direto para CONCLUIDA)', () => {
    expect(() => assertValidTransition('CONCLUIDA', 'ABERTA')).toThrow(ValidationError);
  });

  it('rejeita transição a partir de status final', () => {
    expect(() => assertValidTransition('CONCLUIDA', 'EM_ANDAMENTO')).toThrow(ValidationError);
    expect(() => assertValidTransition('CANCELADA', 'ABERTA')).toThrow(ValidationError);
  });

  it('rejeita "transição" para o mesmo status', () => {
    expect(() => assertValidTransition('EM_ANDAMENTO', 'EM_ANDAMENTO')).toThrow(ValidationError);
  });
});
