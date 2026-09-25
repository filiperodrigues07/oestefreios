import { beforeEach, describe, expect, it, vi } from 'vitest';
import { firebirdQuery } from '../database/firebird/pool.js';

vi.mock('../database/firebird/pool.js', () => ({ firebirdQuery: vi.fn(), firebirdTransaction: vi.fn() }));
vi.mock('../database/postgres/client.js', () => ({ db: { select: () => ({ from: () => ({ where: () => [] }) }) } }));

describe('filtro de prioridade e busca na listagem de OS (empurrados pro SQL)', () => {
  beforeEach(() => vi.mocked(firebirdQuery).mockReset());

  it('prioridade vira OS.PRIORIDADE = ? no SQL', async () => {
    const { OSRepositoryFirebird } = await import('../repositories/firebird/OSRepository.firebird.js');
    vi.mocked(firebirdQuery).mockResolvedValue([]);
    await new OSRepositoryFirebird().listar({ prioridade: 'ALTA', page: 1, limit: 20 });

    const [sql, params] = vi.mocked(firebirdQuery).mock.calls[0]!;
    expect(sql).toContain('OS.PRIORIDADE = ?');
    expect(params).toContain(3);
  });

  it('busca livre casa contra OS.ORDEM, cliente e veículo, não só descrição', async () => {
    const { OSRepositoryFirebird } = await import('../repositories/firebird/OSRepository.firebird.js');
    vi.mocked(firebirdQuery).mockResolvedValue([]);
    await new OSRepositoryFirebird().listar({ busca: 'ABC1234', page: 1, limit: 20 });

    const [sql] = vi.mocked(firebirdQuery).mock.calls[0]!;
    expect(sql).toContain('UPPER(CAST(OS.ORDEM AS VARCHAR(50))) LIKE ?');
    expect(sql).toContain("REPLACE(UPPER(EQ.IDENTIFICACAO), '-', '') LIKE ?");
  });

  it('status e tecnicoId continuam fora do SQL (não são coluna do Firebird)', async () => {
    const { OSRepositoryFirebird } = await import('../repositories/firebird/OSRepository.firebird.js');
    vi.mocked(firebirdQuery).mockResolvedValueOnce([]);
    await new OSRepositoryFirebird().listar({ status: 'CONCLUIDA', tecnicoId: 'tecnico-uuid-x', page: 1, limit: 20 });

    const [sql, params] = vi.mocked(firebirdQuery).mock.calls[0]!;
    expect(sql).not.toContain('CONCLUIDA');
    expect(params).not.toContain('tecnico-uuid-x');
  });

  it('listagem padrão pagina no SQL (FIRST/SKIP) e conta à parte, sem trazer todos os cabeçalhos', async () => {
    const { OSRepositoryFirebird } = await import('../repositories/firebird/OSRepository.firebird.js');
    vi.mocked(firebirdQuery).mockImplementation(async (sql: string) => (String(sql).includes('COUNT(*)') ? [{ TOTAL: 137 }] : []) as never);
    const r = await new OSRepositoryFirebird().listar({ page: 3, limit: 20 });

    const sqls = vi.mocked(firebirdQuery).mock.calls.map(([sql]) => sql);
    expect(sqls.some((q) => q.includes('FIRST 20 SKIP 40'))).toBe(true);
    expect(sqls.some((q) => q.includes('COUNT(*) AS TOTAL') && q.includes('FROM ORDEMSERVICO OS'))).toBe(true);
    expect(r.total).toBe(137);
  });
});
