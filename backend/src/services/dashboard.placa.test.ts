import { describe, expect, it } from 'vitest';
import { pareceUmaPlaca } from './dashboard.service.js';

describe('pareceUmaPlaca', () => {
  it('reconhece placa antiga e Mercosul, com ou sem hífen', () => {
    for (const placa of ['ABC-1234', 'abc1234', 'ABC1D23', 'abc-1d23', ' ABC1234 ']) {
      expect(pareceUmaPlaca(placa), placa).toBe(true);
    }
  });

  it('não confunde número de OS, nome ou código com placa', () => {
    for (const termo of ['1234', '000123', 'JOAO', 'ABC', 'ABCD1234', 'ABC-12', 'CELTA 2010', '']) {
      expect(pareceUmaPlaca(termo), termo).toBe(false);
    }
  });
});
