import { describe, expect, it } from 'vitest';
import { criarOSSchema, duplicarOSSchema, atualizarOSSchema } from './os.validator.js';

const cabecalho = { clienteCodigo: '1', equipamentoCodigo: '2' };
describe('KM obrigatórios na abertura', () => {
  for (const schema of [criarOSSchema, duplicarOSSchema]) {
    const input = schema === criarOSSchema ? cabecalho : {};
    it('recusa ausentes e vazios', () => {
      expect(schema.safeParse(input).success).toBe(false);
      expect(schema.safeParse({ ...input, kmAtual: '', kmFinal: '0' }).success).toBe(false);
      expect(schema.safeParse({ ...input, kmAtual: '0', kmFinal: '' }).success).toBe(false);
    });
    it('aceita zero, KM iguais e KM final menor', () => {
      expect(schema.safeParse({ ...input, kmAtual: 0, kmFinal: 0 }).success).toBe(true);
      expect(schema.safeParse({ ...input, kmAtual: 123, kmFinal: 123 }).success).toBe(true);
      expect(schema.safeParse({ ...input, kmAtual: 123, kmFinal: 120 }).success).toBe(true);
    });
  }
  it('mantém edição de OS antiga sem KM', () => {
    expect(atualizarOSSchema.safeParse({ diagnostico: 'ok' }).success).toBe(true);
  });
});
