import { describe, expect, it } from 'vitest';
import { alternarVisivel, applyOrder, clampWidth, hasCustomPrefs, MAX_COLUMN_WIDTH, MIN_COLUMN_WIDTH, moverColuna, sanitizePrefs } from './columnLayout.js';

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
    expect(prefs).toEqual({ order: ['a', 'b'], widths: { a: MIN_COLUMN_WIDTH, b: MAX_COLUMN_WIDTH, e: 200 }, hidden: [] });
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
    expect(hasCustomPrefs({ order: [], widths: {}, hidden: [] })).toBe(false);
    expect(hasCustomPrefs({ order: [], widths: { a: 100 }, hidden: [] })).toBe(true);
    expect(hasCustomPrefs({ order: ['a'], widths: {}, hidden: [] })).toBe(true);
    expect(hasCustomPrefs({ order: [], widths: {}, hidden: ['a'] })).toBe(true);
  });
});

describe('moverColuna', () => {
  const ordem = ['a', 'b', 'c', 'd'];

  it('insere na posição da linha azul (índice entre colunas)', () => {
    expect(moverColuna(ordem, 'a', 4)).toEqual(['b', 'c', 'd', 'a']);
    expect(moverColuna(ordem, 'd', 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moverColuna(ordem, 'b', 3)).toEqual(['a', 'c', 'b', 'd']);
    expect(moverColuna(ordem, 'c', 1)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('soltar no mesmo lugar não muda nada', () => {
    expect(moverColuna(ordem, 'b', 1)).toBe(ordem);
    expect(moverColuna(ordem, 'b', 2)).toBe(ordem);
    expect(moverColuna(ordem, 'x', 0)).toBe(ordem);
  });
});

describe('alternarVisivel', () => {
  const todas = ['a', 'b', 'c'];

  it('esconde e mostra de novo', () => {
    expect(alternarVisivel([], 'b', todas)).toEqual(['b']);
    expect(alternarVisivel(['b'], 'b', todas)).toEqual([]);
  });

  it('nunca esconde a última coluna visível', () => {
    expect(alternarVisivel(['a', 'b'], 'c', todas)).toEqual(['a', 'b']);
  });
});

describe('sanitizePrefs com colunas ocultas', () => {
  it('preferência antiga sem hidden vira nenhuma escondida; lixo é descartado', () => {
    expect(sanitizePrefs({ order: [], widths: {} })?.hidden).toEqual([]);
    expect(sanitizePrefs({ order: [], widths: {}, hidden: ['a', 1, 'a'] })?.hidden).toEqual(['a']);
  });
});
