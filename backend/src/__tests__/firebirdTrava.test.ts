import { beforeEach, describe, expect, it, vi } from 'vitest';
import { erroDeTrava } from '../database/firebird/lockError.js';

const get = vi.fn();
const criarPool = vi.fn(() => ({ get, destroy: vi.fn((cb: () => void) => cb()) }));

vi.mock('node-firebird', () => {
  const driver = { pool: criarPool, ISOLATION_READ_COMMITTED: [1], ISOLATION_READ_UNCOMMITTED: [2] };
  return { ...driver, default: driver };
});

const TIMEOUT = new Error('Operation was cancelled, Statement level timeout expired.');

function conexaoComErro(err: Error) {
  const detach = vi.fn();
  const query = vi.fn((_sql: string, _params: unknown[], cb: (e: Error | null, r?: unknown) => void) => cb(err));
  const transaction = vi.fn((_isolamento: unknown, cb: (e: Error | null, t?: unknown) => void) =>
    cb(null, { query, commit: vi.fn((done: (e: Error | null) => void) => done(null)), rollback: vi.fn((done: () => void) => done()) }),
  );
  return { detach, query, transaction };
}

describe('trava no Firebird (registro em uso no CHERP)', () => {
  beforeEach(() => {
    vi.resetModules();
    get.mockReset();
  });

  it('reconhece timeout de espera, conflito de atualização e deadlock', () => {
    expect(erroDeTrava(TIMEOUT)).toBe(true);
    expect(erroDeTrava(Object.assign(new Error('x'), { gdscode: 335544345 }))).toBe(true);
    expect(erroDeTrava(new Error('lock conflict on no wait transaction'))).toBe(true);
    expect(erroDeTrava(new Error('deadlock'))).toBe(true);
    expect(erroDeTrava(new Error('update conflicts with concurrent update'))).toBe(true);
  });

  it('não confunde outros erros com trava', () => {
    expect(erroDeTrava(new Error('SQL inválido'))).toBe(false);
    expect(erroDeTrava(Object.assign(new Error('x'), { gdscode: 335544665 }))).toBe(false);
    expect(erroDeTrava('Statement level timeout expired')).toBe(false);
    expect(erroDeTrava(null)).toBe(false);
  });

  it('gravação numa transação que esbarra na trava vira 409 CHERP_REGISTRO_EM_USO', async () => {
    const db = conexaoComErro(TIMEOUT);
    get.mockImplementation((cb: (e: null, d: unknown) => void) => cb(null, db));
    const { firebirdTransaction } = await import('../database/firebird/pool.js');
    const erro = (await firebirdTransaction((query) => query('UPDATE ORDEMSERVICO SET X = 1')).catch((e: unknown) => e)) as { code: string; statusCode: number; message: string };
    expect(erro.code).toBe('CHERP_REGISTRO_EM_USO');
    expect(erro.statusCode).toBe(409);
    expect(erro.message).toMatch(/em uso no CHERP/);
    expect(db.detach).toHaveBeenCalledTimes(1);
  });

  it('UPDATE avulso com timeout também vira 409', async () => {
    const db = conexaoComErro(TIMEOUT);
    get.mockImplementation((cb: (e: null, d: unknown) => void) => cb(null, db));
    const { firebirdQuery } = await import('../database/firebird/pool.js');
    await expect(firebirdQuery('UPDATE ORDEMSERVICO SET ATIVO = 0 WHERE CHAVE = 1')).rejects.toMatchObject({ code: 'CHERP_REGISTRO_EM_USO', statusCode: 409 });
  });

  it('SELECT lento (timeout) NÃO vira "em uso": continua 503, é lentidão e não trava', async () => {
    const db = conexaoComErro(TIMEOUT);
    get.mockImplementation((cb: (e: null, d: unknown) => void) => cb(null, db));
    const { firebirdQuery } = await import('../database/firebird/pool.js');
    await expect(firebirdQuery('SELECT * FROM ORDEMSERVICO')).rejects.toMatchObject({ code: 'FIREBIRD_UNAVAILABLE', statusCode: 503 });
  });
});
