import { describe, expect, it } from 'vitest';
import { sanitizarChassi, sanitizarPlaca, somenteDigitos } from './veiculoFormatters.js';

describe('formatadores de veículo', () => {
  it('placa: maiúscula, sem espaço/ponto, até 8 caracteres', () => {
    expect(sanitizarPlaca('abc 1d23')).toBe('ABC1D23');
    expect(sanitizarPlaca('abc-1234x')).toBe('ABC-1234');
    expect(sanitizarPlaca('a.b/c')).toBe('ABC');
  });

  it('chassi: 17 alfanuméricos', () => {
    expect(sanitizarChassi('9bw zzz377 vt004251 ')).toBe('9BWZZZ377VT004251');
  });

  it('dígitos com limite', () => {
    expect(somenteDigitos('12.345 km')).toBe('12345');
    expect(somenteDigitos('20a24x', 4)).toBe('2024');
  });
});
