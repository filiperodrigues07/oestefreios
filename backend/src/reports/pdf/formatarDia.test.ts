import { describe, expect, it } from 'vitest';
import { formatarDia } from './OSDocument.js';

describe('formatarDia (garantia no PDF da OS)', () => {
  it('formata o dia de calendário sem deslocar por fuso', () => {
    expect(formatarDia('2026-10-02')).toBe('02/10/2026');
    expect(formatarDia('2027-01-01')).toBe('01/01/2027');
    expect(formatarDia('2026-12-31')).toBe('31/12/2026');
  });

  it('mostra traço quando não há data válida', () => {
    expect(formatarDia(undefined)).toBe('—');
    expect(formatarDia('')).toBe('—');
    expect(formatarDia('02/10/2026')).toBe('—');
  });
});
