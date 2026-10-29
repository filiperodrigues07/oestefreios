import { describe, expect, it } from 'vitest';
import { direcaoCfop, sqlAlinharCfop } from './OSRepository.firebird.js';

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
