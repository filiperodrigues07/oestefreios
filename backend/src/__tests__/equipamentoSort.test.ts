import { beforeEach, describe, expect, it, vi } from 'vitest';
import { firebirdQuery } from '../database/firebird/pool.js';
import { EquipamentoRepositoryFirebird } from '../repositories/firebird/EquipamentoRepository.firebird.js';

vi.mock('../database/firebird/pool.js', () => ({ firebirdQuery: vi.fn(), firebirdTransaction: vi.fn() }));

describe('ordenação paginada de veículos', () => {
  beforeEach(() => vi.mocked(firebirdQuery).mockReset());

  it('ordena no Firebird antes de paginar e usa código como desempate', async () => {
    vi.mocked(firebirdQuery).mockResolvedValueOnce([]).mockResolvedValueOnce([{ TOTAL: 0 }]);
    await new EquipamentoRepositoryFirebird().buscar({ page: 2, limit: 20, sortBy: 'identificacao', sortOrder: 'desc', anoFabricacao: 2020 });
    const [sql, params] = vi.mocked(firebirdQuery).mock.calls[0]!;
    expect(sql).toContain('ORDER BY E.IDENTIFICACAO DESC, E.CODIGO ASC');
    expect(params?.slice(0, 2)).toEqual([20, 20]);
    expect(params?.slice(4, 6)).toEqual([2020, 2020]);
  });
});
