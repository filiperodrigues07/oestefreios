import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const destroy = vi.fn((cb: () => void) => cb());
const criarPool = vi.fn(() => ({ get, destroy }));

vi.mock('node-firebird', () => ({ pool: criarPool, default: { pool: criarPool } }));

function conexao(resultado: { err?: Error; rows?: unknown }) {
  const detach = vi.fn();
  return {
    detach,
    query: vi.fn((_sql: string, _params: unknown[], cb: (e: Error | null, r?: unknown) => void) => cb(resultado.err ?? null, resultado.rows)),
  };
}

describe('pool Firebird', () => {
  beforeEach(async () => {
    vi.resetModules();
    get.mockReset();
    destroy.mockClear();
    criarPool.mockClear();
  });

  afterEach(() => vi.useRealTimers());

  it('devolve a conexão ao pool (detach) depois da query', async () => {
    const db = conexao({ rows: [{ A: 1 }] });
    get.mockImplementationOnce((cb: (e: null, d: unknown) => void) => cb(null, db));
    const { firebirdQuery } = await import('../database/firebird/pool.js');
    expect(await firebirdQuery('SELECT 1 FROM RDB$DATABASE')).toEqual([{ A: 1 }]);
    expect(db.detach).toHaveBeenCalledTimes(1);
  });

  it('falha de conexão: tenta 3 vezes com backoff e vira ExternalServiceError', async () => {
    vi.useFakeTimers();
    get.mockImplementation((cb: (e: Error) => void) => cb(new Error('rede')));
    const { firebirdQuery } = await import('../database/firebird/pool.js');
    const resultado = firebirdQuery('SELECT 1').catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(300 + 600);
    const erro = (await resultado) as { code: string; statusCode: number };
    expect(get).toHaveBeenCalledTimes(3);
    expect(erro.code).toBe('FIREBIRD_UNAVAILABLE');
    expect(erro.statusCode).toBe(503);
  });

  it('erro de query não é repetido e a conexão é liberada', async () => {
    const db = conexao({ err: new Error('SQL inválido') });
    get.mockImplementation((cb: (e: null, d: unknown) => void) => cb(null, db));
    const { firebirdQuery } = await import('../database/firebird/pool.js');
    await expect(firebirdQuery('SELECT x')).rejects.toMatchObject({ code: 'FIREBIRD_UNAVAILABLE' });
    expect(get).toHaveBeenCalledTimes(1);
    expect(db.detach).toHaveBeenCalledTimes(1);
  });

  it('closeFirebirdPool destrói o pool e a próxima query cria outro', async () => {
    const db = conexao({ rows: [] });
    get.mockImplementation((cb: (e: null, d: unknown) => void) => cb(null, db));
    const { closeFirebirdPool, firebirdQuery } = await import('../database/firebird/pool.js');
    await firebirdQuery('SELECT 1');
    await closeFirebirdPool();
    expect(destroy).toHaveBeenCalledTimes(1);
    await firebirdQuery('SELECT 1');
    expect(criarPool).toHaveBeenCalledTimes(2);
  });

  it('closeFirebirdPool sem pool aberto não faz nada', async () => {
    const { closeFirebirdPool } = await import('../database/firebird/pool.js');
    await closeFirebirdPool();
    expect(destroy).not.toHaveBeenCalled();
  });
});

