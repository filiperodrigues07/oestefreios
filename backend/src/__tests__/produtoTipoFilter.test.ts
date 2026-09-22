import { beforeEach, describe, expect, it, vi } from 'vitest';
import { firebirdQuery } from '../database/firebird/pool.js';
import { ProdutoRepositoryFirebird } from '../repositories/firebird/ProdutoRepository.firebird.js';

vi.mock('../database/firebird/pool.js', () => ({ firebirdQuery: vi.fn() }));

describe('filtro de tipo no catálogo de produtos', () => {
  beforeEach(() => {
    vi.mocked(firebirdQuery).mockReset();
    vi.mocked(firebirdQuery).mockResolvedValueOnce([]).mockResolvedValueOnce([{ TOTAL: 0 }]);
  });

  it.each([
    ['somente', '='],
    ['exceto', '<>'],
  ] as const)('aplica %s na página e na contagem', async (tipoModo, operador) => {
    await new ProdutoRepositoryFirebird().buscar({
      busca: 'filtro', tipoCodigo: 2, tipoModo, page: 2, limit: 20,
    });

    const [sqlPagina, paramsPagina] = vi.mocked(firebirdQuery).mock.calls[0]!;
    const [sqlContagem, paramsContagem] = vi.mocked(firebirdQuery).mock.calls[1]!;
    expect(sqlPagina).toContain(`AND P.TIPO ${operador} ?`);
    expect(sqlContagem).toContain(`AND P.TIPO ${operador} ?`);
    expect(paramsPagina?.slice(-1)).toEqual([2]);
    expect(paramsContagem?.slice(-1)).toEqual([2]);
    expect(paramsPagina?.slice(0, 2)).toEqual([20, 20]);
  });
});
