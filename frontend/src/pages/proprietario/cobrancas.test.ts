import { describe, expect, it } from 'vitest';
import type { CobrancaDTO } from '../../types/billing.types.js';
import {
  cobrancasCsv,
  contarFiltros,
  filtrarCobrancas,
  proximaReferenciaLivre,
  referenciasSeguidas,
  vencimentoDoMes,
} from './cobrancas.js';

function cobranca(parcial: Partial<CobrancaDTO>): CobrancaDTO {
  return {
    id: parcial.referencia ?? 'x',
    referencia: '2026-10',
    vencimento: '2026-10-10',
    valor: 300,
    observacao: '',
    arquivoNome: 'b.pdf',
    arquivoTamanho: 10,
    linhaDigitavel: '',
    pixCopiaCola: '',
    criadoEm: '',
    criadoPor: '',
    enviadoEm: null,
    enviadoPara: [],
    envios: 0,
    pagoEm: null,
    lembretes: [],
    ...parcial,
  };
}

describe('cobranças', () => {
  it('calcula meses e vencimentos', () => {
    expect(referenciasSeguidas('2026-12', 2)).toEqual(['2026-12', '2027-01']);
    expect(vencimentoDoMes('2028-02', 31)).toBe('2028-02-29');
  });

  it('sugere o primeiro mês ainda sem cobrança', () => {
    const lista = [cobranca({ referencia: '2026-10' }), cobranca({ referencia: '2026-11' })];
    expect(proximaReferenciaLivre(lista, '2026-10-10')).toBe('2026-12');
    expect(proximaReferenciaLivre([], '2026-10-10')).toBe('2026-10');
  });

  it('filtra e ordena por situação', () => {
    const lista = [
      cobranca({ referencia: '2026-11', vencimento: '2026-11-10', arquivoNome: null }),
      cobranca({ referencia: '2026-09', vencimento: '2026-09-10' }),
      cobranca({ referencia: '2026-08', vencimento: '2026-08-10', pagoEm: '2026-08-09' }),
    ];
    const hoje = '2026-10-02';
    expect(filtrarCobrancas(lista, 'abertas', hoje).map((item) => item.referencia)).toEqual([
      '2026-09',
      '2026-11',
    ]);
    expect(filtrarCobrancas(lista, 'vencidas', hoje).map((item) => item.referencia)).toEqual([
      '2026-09',
    ]);
    expect(filtrarCobrancas(lista, 'semBoleto', hoje).map((item) => item.referencia)).toEqual([
      '2026-11',
    ]);
    expect(contarFiltros(lista, hoje)).toEqual({
      abertas: 2,
      vencidas: 1,
      semBoleto: 1,
      pagas: 1,
      todas: 3,
    });
  });

  it('gera CSV brasileiro com atraso e escapa texto', () => {
    const csv = cobrancasCsv(
      [
        cobranca({
          referencia: '2026-09',
          vencimento: '2026-09-10',
          valor: 1234.5,
          pagoEm: '2026-09-15',
          observacao: 'pago; com "atraso"',
        }),
        cobranca({ referencia: '2026-10', vencimento: '2026-10-10', arquivoNome: null }),
      ],
      '2026-10-02',
    );
    const linhas = csv.replace('\uFEFF', '').trim().split('\r\n');
    expect(linhas[0]).toContain('Referência;Vencimento;Valor');
    expect(linhas[1]).toBe(
      '09/2026;10/09/2026;1234,50;Paga;15/09/2026;5;Sim;;0;"pago; com ""atraso"""',
    );
    expect(linhas[2]).toBe('10/2026;10/10/2026;300,00;Em aberto;;-8;Não;;0;');
  });
});
