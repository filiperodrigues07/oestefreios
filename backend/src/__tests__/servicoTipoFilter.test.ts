import { beforeEach, describe, expect, it, vi } from 'vitest';
import { firebirdQuery } from '../database/firebird/pool.js';
import { ServicoRepositoryFirebird } from '../repositories/firebird/ServicoRepository.firebird.js';
import { searchQuerySchema } from '../validators/search.validator.js';

vi.mock('../database/firebird/pool.js', () => ({ firebirdQuery: vi.fn() }));

describe('filtro de tipo no catálogo de serviços', () => {
  beforeEach(() => {
    vi.mocked(firebirdQuery).mockReset();
  });

  it('aplica o código do tipo à página e à contagem', async () => {
    vi.mocked(firebirdQuery).mockResolvedValueOnce([
      { CODIGO: '000348', DESCRICAO: 'SERVIÇO', UNIDADE: 'UN', TIPO_SERVICO_CODIGO: '140101' },
    ]).mockResolvedValueOnce([{ TOTAL: 275 }]);

    const query = searchQuerySchema.parse({ tipoServicoCodigo: '140101', page: '2', limit: '20' });
    const result = await new ServicoRepositoryFirebird().buscar(query);

    const [sqlPagina, paramsPagina] = vi.mocked(firebirdQuery).mock.calls[0]!;
    const [sqlContagem, paramsContagem] = vi.mocked(firebirdQuery).mock.calls[1]!;
    expect(sqlPagina).toContain('AND TS.CODIGO = ?');
    expect(sqlContagem).toContain('AND TS.CODIGO = ?');
    expect(paramsPagina?.slice(0, 2)).toEqual([20, 20]);
    expect(paramsPagina?.slice(-1)).toEqual(['140101']);
    expect(paramsContagem?.slice(-1)).toEqual(['140101']);
    expect(result.total).toBe(275);
    expect(result.items[0]?.tipoServicoCodigo).toBe('140101');
  });

  it('lista os tipos que podem ser usados no filtro', async () => {
    vi.mocked(firebirdQuery).mockResolvedValueOnce([
      { CODIGO: '140101', DESCRICAO: 'Manutenção de veículos' },
    ]);

    const tipos = await new ServicoRepositoryFirebird().listarTipos();

    expect(tipos).toEqual([{ codigo: '140101', descricao: 'Manutenção de veículos' }]);
    expect(vi.mocked(firebirdQuery).mock.calls[0]?.[0]).toContain('JOIN PRODTIPOSERV');
  });
});
