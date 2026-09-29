import { describe, expect, it } from 'vitest';
import { catalogTokens, matchesCatalogSearch } from './catalogSearch.js';
import { catalogSearchCondition } from '../repositories/firebird/catalogSearch.js';

describe('busca por descrição no catálogo', () => {
  it('encontra palavras fora de sequência, sem acentos e com prefixos parciais', () => {
    const descricao = 'SERVIÇO TROCA DE LONA CARRETA 3º EX LE';
    expect(matchesCatalogSearch('servico lona carr', [descricao])).toBe(true);
    expect(matchesCatalogSearch('lona 3º ex le', [descricao])).toBe(true);
    expect(matchesCatalogSearch('lona cavalo', [descricao])).toBe(false);
    expect(catalogTokens('serviço troca de lona')).toEqual(['SERVICO', 'TROCA', 'LONA']);
  });

  it('gera uma condição parametrizada para cada palavra', () => {
    const search = catalogSearchCondition('troca lona', ['P.DESCRICAO', 'G.DESCRICAO']);
    expect(search.clause).toContain(' AND ');
    expect(search.clause).toContain('UNICODE_CI_AI');
    expect(search.params).toHaveLength(6);
    expect(search.params[1]).toBe('%TROCA%');
    expect(search.params[4]).toBe('%LONA%');
  });
});
