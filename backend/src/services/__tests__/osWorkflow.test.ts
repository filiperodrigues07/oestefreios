import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../errors/ValidationError.js';
import { assertValidTransition } from '../osWorkflow.js';

describe('workflow de status da OS (seção 17)', () => {
  it('permite transições do fluxo principal', () => {
    expect(() => assertValidTransition('ABERTA', 'EM_ANALISE')).not.toThrow();
    expect(() => assertValidTransition('EM_ANALISE', 'EM_ANDAMENTO')).not.toThrow();
    expect(() => assertValidTransition('EM_ANDAMENTO', 'CONCLUIDA')).not.toThrow();
  });

  it('permite os desvios documentados (aguardando peça/cliente e volta)', () => {
    expect(() => assertValidTransition('EM_ANDAMENTO', 'AGUARDANDO_PECA')).not.toThrow();
    expect(() => assertValidTransition('AGUARDANDO_PECA', 'EM_ANDAMENTO')).not.toThrow();
    expect(() => assertValidTransition('EM_ANDAMENTO', 'AGUARDANDO_CLIENTE')).not.toThrow();
    expect(() => assertValidTransition('AGUARDANDO_CLIENTE', 'EM_ANDAMENTO')).not.toThrow();
  });

  it('rejeita pular etapas (ABERTA direto para CONCLUIDA)', () => {
    expect(() => assertValidTransition('ABERTA', 'CONCLUIDA')).toThrow(ValidationError);
  });

  it('rejeita transição a partir de status final', () => {
    expect(() => assertValidTransition('CONCLUIDA', 'EM_ANDAMENTO')).toThrow(ValidationError);
    expect(() => assertValidTransition('CANCELADA', 'ABERTA')).toThrow(ValidationError);
  });

  it('rejeita "transição" para o mesmo status', () => {
    expect(() => assertValidTransition('EM_ANDAMENTO', 'EM_ANDAMENTO')).toThrow(ValidationError);
  });
});
