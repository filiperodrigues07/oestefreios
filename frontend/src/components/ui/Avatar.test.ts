import { describe, expect, it } from 'vitest';
import { getInitials } from './Avatar.js';

describe('iniciais do avatar', () => {
  it('ignora pontuação e números', () => {
    expect(getInitials('Admin (dev)')).toBe('AD');
    expect(getInitials('Oficina 2 - Filial')).toBe('OF');
    expect(getInitials('  ')).toBe('?');
    expect(getInitials('(123)')).toBe('?');
  });

  it('mantém acentos e usa primeiro e último nome', () => {
    expect(getInitials('érica de souza')).toBe('ÉS');
    expect(getInitials('Filipe')).toBe('FI');
  });
});
