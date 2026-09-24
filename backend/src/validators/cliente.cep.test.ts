import { describe, expect, it } from 'vitest';
import { normalizarCep } from './cliente.validator.js';

describe('normalizarCep', () => {
  it('padroniza CEP só com dígitos para o formato do CHERP', () => {
    expect(normalizarCep('95760000')).toBe('95760-000');
    expect(normalizarCep('89600-000')).toBe('89600-000');
    expect(normalizarCep('89.600-000')).toBe('89600-000');
  });

  it('não mexe em valor incompleto', () => {
    expect(normalizarCep('8960')).toBe('8960');
    expect(normalizarCep('')).toBe('');
  });
});
