import { describe, expect, it } from 'vitest';
import { direcaoCfop, naoContribuinte, operacaoDeVenda, sqlAlinharCfop } from './OSRepository.firebird.js';

describe('CFOP dentro/fora do estado', () => {
  it('compara a UF do cliente com a da empresa', () => {
    expect(direcaoCfop('RS', 'SC')).toBe('FE');
    expect(direcaoCfop(' sc ', 'SC')).toBe('DE');
    expect(direcaoCfop(null, 'SC')).toBeNull();
    expect(direcaoCfop('PR', '')).toBeNull();
  });

  it('fora do estado troca a coluna DE pela FE da própria operação, em cabeçalho e itens', () => {
    const [cabecalho, produtos, servicos] = sqlAlinharCfop('FE');
    expect(cabecalho).toContain('ORDEMSERVICO.CHAVECFOPPROD = P.CHAVECFOPPRODDE THEN P.CHAVECFOPPRODFE');
    expect(cabecalho).toContain('ORDEMSERVICO.CHAVECFOPSERV = P.CHAVECFOPSERVDE THEN P.CHAVECFOPSERVFE');
    expect(produtos).toContain('ITENSORDEMSERVICOPROD.CHAVECFOP = P.CHAVECFOPPRODDE THEN P.CHAVECFOPPRODFE');
    expect(produtos).toContain('P.CHAVE = ITENSORDEMSERVICOPROD.CHAVECFOPOPERFISCAIS');
    expect(servicos).toContain('ITENSORDEMSERVICOSERV.CHAVECFOP = P.CHAVECFOPSERVDE THEN P.CHAVECFOPSERVFE');
    // CFOP escolhido à mão (nem DE nem FE da operação) continua o mesmo.
    expect(produtos).toContain('ITENSORDEMSERVICOPROD.CHAVECFOP)');
  });

  it('dentro do estado desfaz: FE volta para DE (troca de cliente)', () => {
    const [cabecalho, produtos] = sqlAlinharCfop('DE');
    expect(cabecalho).toContain('= P.CHAVECFOPPRODFE THEN P.CHAVECFOPPRODDE');
    expect(produtos).toContain('= P.CHAVECFOPPRODFE THEN P.CHAVECFOPPRODDE');
  });
});

describe('operação de venda para não contribuinte fora do estado', () => {
  it('pessoa física ou empresa sem IE (vazia ou ISENTO) não é contribuinte', () => {
    expect(naoContribuinte(1, '12.345.678-9')).toBe(true);
    expect(naoContribuinte(0, 'ISENTO')).toBe(true);
    expect(naoContribuinte(0, ' isento ')).toBe(true);
    expect(naoContribuinte(0, '')).toBe(true);
    expect(naoContribuinte(0, null)).toBe(true);
    expect(naoContribuinte(0, '124/0271104')).toBe(false);
  });

  it('002 só fora do estado e para não contribuinte; o resto fica na 001', () => {
    expect(operacaoDeVenda('FE', true)).toBe('002');
    expect(operacaoDeVenda('FE', false)).toBe('001');
    // Pessoa física em SC continua na 001 (5102), como nos faturamentos.
    expect(operacaoDeVenda('DE', true)).toBe('001');
    expect(operacaoDeVenda('DE', false)).toBe('001');
  });
});

