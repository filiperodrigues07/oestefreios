import { describe, expect, it } from 'vitest';
import { applyOrder, clampWidth, hasCustomPrefs, MAX_COLUMN_WIDTH, MIN_COLUMN_WIDTH, sanitizePrefs } from './columnLayout.js';

describe('clampWidth', () => {
  it('respeita mínimo e máximo e arredonda', () => {
    expect(clampWidth(10)).toBe(MIN_COLUMN_WIDTH);
    expect(clampWidth(99999)).toBe(MAX_COLUMN_WIDTH);
    expect(clampWidth(120.6)).toBe(121);
  });
});

describe('sanitizePrefs', () => {
  it('descarta lixo e formatos inválidos', () => {
    expect(sanitizePrefs(null)).toBeNull();
    expect(sanitizePrefs('x')).toBeNull();
    expect(sanitizePrefs({ order: 'a', widths: {} })).toBeNull();
    expect(sanitizePrefs({ order: [], widths: [] })).toBeNull();
  });

  it('mantém só dados válidos, limita larguras e remove chaves repetidas', () => {
    const prefs = sanitizePrefs({ order: ['a', 'b', 'a', 3], widths: { a: 5, b: 9999, c: 'x', d: NaN, e: 200 } });
    expect(prefs).toEqual({ order: ['a', 'b'], widths: { a: MIN_COLUMN_WIDTH, b: MAX_COLUMN_WIDTH, e: 200 } });
  });
});

describe('applyOrder', () => {
  const colunas = [{ key: 'a' }, { key: 'b' }, { key: 'c' }];

  it('sem ordem salva mantém a original', () => {
    expect(applyOrder(colunas, null)).toBe(colunas);
    expect(applyOrder(colunas, [])).toBe(colunas);
  });

  it('aplica a ordem, joga colunas novas pro fim e ignora as que sumiram', () => {
    expect(applyOrder(colunas, ['c', 'x', 'a']).map((c) => c.key)).toEqual(['c', 'a', 'b']);
  });
});

describe('hasCustomPrefs', () => {
  it('só considera personalizado quando há ordem ou largura salva', () => {
    expect(hasCustomPrefs(null)).toBe(false);
    expect(hasCustomPrefs({ order: [], widths: {} })).toBe(false);
    expect(hasCustomPrefs({ order: [], widths: { a: 100 } })).toBe(true);
    expect(hasCustomPrefs({ order: ['a'], widths: {} })).toBe(true);
  });
});
