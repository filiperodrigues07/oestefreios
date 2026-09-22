import { beforeEach, describe, expect, it, vi } from 'vitest';
import { firebirdQuery } from '../database/firebird/pool.js';
import { ProdutoRepositoryFirebird } from '../repositories/firebird/ProdutoRepository.firebird.js';

vi.mock('../database/firebird/pool.js', () => ({ firebirdQuery: vi.fn() }));

describe('filtro de saldo no catálogo de produtos', () => {
  beforeEach(() => {
    vi.mocked(firebirdQuery).mockReset();
    vi.mocked(firebirdQuery).mockResolvedValueOnce([]).mockResolvedValueOnce([{ TOTAL: 0 }]);
  });

  it.each([
    ['com_saldo', '> 0'],
    ['negativo', '< 0'],
  ] as const)('aplica %s na página e na contagem, sem parâmetro novo', async (saldoModo, operador) => {
    await new ProdutoRepositoryFirebird().buscar({ busca: 'filtro', saldoModo, page: 1, limit: 20 });

    const [sqlPagina] = vi.mocked(firebirdQuery).mock.calls[0]!;
    const [sqlContagem] = vi.mocked(firebirdQuery).mock.calls[1]!;
    expect(sqlPagina).toContain(`PE.ATIVO = 1) ${operador}`);
    expect(sqlContagem).toContain(`PE.ATIVO = 1) ${operador}`);
  });

  it('sem_saldo trata NULL (sem linha de estoque) como zero', async () => {
    await new ProdutoRepositoryFirebird().buscar({ busca: 'filtro', saldoModo: 'sem_saldo', page: 1, limit: 20 });

    const [sqlPagina] = vi.mocked(firebirdQuery).mock.calls[0]!;
    expect(sqlPagina).toContain('COALESCE((SELECT SUM(PE.SALDO)');
    expect(sqlPagina).toContain('), 0) = 0');
  });

  it('todos (ou ausente) não adiciona cláusula de saldo no WHERE', async () => {
    await new ProdutoRepositoryFirebird().buscar({ busca: 'filtro', page: 1, limit: 20 });

    const [sqlPagina] = vi.mocked(firebirdQuery).mock.calls[0]!;
    // DISPONIVEL/ESTOQUE_MINIMO no SELECT sempre referenciam PRODUTOESTOQUE — só a cláusula
    // "AND (SELECT SUM..." extra no WHERE indica que o filtro de saldo foi aplicado.
    expect(sqlPagina).not.toContain('AND (SELECT SUM(PE.SALDO)');
    expect(sqlPagina).not.toContain('AND COALESCE((SELECT SUM(PE.SALDO)');
  });
});
