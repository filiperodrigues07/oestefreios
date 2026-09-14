import { describe, expect, it } from 'vitest';
import type { OrdemServico } from '../../types/cherp.types.js';
import { toOSDTO } from '../mappers/os.mapper.js';
import { toProdutoDTO } from '../mappers/produto.mapper.js';
import { toServicoDTO } from '../mappers/servico.mapper.js';

const FINANCIAL_FIELDS = ['preco', 'precoUnitario', 'desconto', 'total', 'custo', 'faturamento', 'valorUnitario'];

function assertNoFinancialFields(value: unknown) {
  const json = JSON.stringify(value);
  for (const field of FINANCIAL_FIELDS) {
    expect(json.includes(`"${field}"`)).toBe(false);
  }
}

const os: OrdemServico = {
  id: '1',
  numero: 1234,
  clienteCodigo: '000001',
  equipamentoCodigo: 'EQ01',
  status: 'EM_ANDAMENTO',
  prioridade: 'NORMAL',
  problema: 'Barulho no motor',
  produtos: [
    {
      produtoCodigo: '00012345',
      descricao: 'Filtro de óleo',
      unidade: 'UN',
      quantidade: 1,
      precoUnitario: 50,
      desconto: 0,
      total: 50,
    },
  ],
  servicos: [
    {
      servicoCodigo: '5012',
      descricao: 'Troca de óleo',
      unidade: 'SERV',
      quantidade: 1,
      valorUnitario: 80,
      total: 80,
    },
  ],
  dataAbertura: new Date().toISOString(),
  faturamento: 130,
};

describe('regra crítica: usuário operacional nunca recebe dado financeiro', () => {
  it('toOSDTO sem FINANCIAL_VIEW não contém nenhum campo financeiro', () => {
    const dto = toOSDTO(os, ['OS_VIEW']);
    assertNoFinancialFields(dto);
  });

  it('toOSDTO com FINANCIAL_VIEW contém os campos financeiros', () => {
    const dto = toOSDTO(os, ['OS_VIEW', 'FINANCIAL_VIEW']);
    const json = JSON.stringify(dto);
    expect(json).toContain('"precoUnitario"');
    expect(json).toContain('"faturamento"');
  });

  it('toProdutoDTO sem FINANCIAL_VIEW não contém preço nem custo', () => {
    const dto = toProdutoDTO(
      { codigo: '00012345', descricao: 'Filtro de óleo', unidade: 'UN', precoUnitario: 50, custo: 30 },
      [],
    );
    assertNoFinancialFields(dto);
  });

  it('toServicoDTO sem FINANCIAL_VIEW não contém valor', () => {
    const dto = toServicoDTO({ codigo: '5012', descricao: 'Troca de óleo', unidade: 'SERV', valorUnitario: 80 }, []);
    assertNoFinancialFields(dto);
  });
});
