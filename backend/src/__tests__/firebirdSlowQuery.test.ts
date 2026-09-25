import { describe, expect, it, vi } from 'vitest';

const { warn } = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock('../utils/logger.js', () => ({ logger: { warn, error: vi.fn(), info: vi.fn() } }));
vi.mock('node-firebird', () => ({ pool: vi.fn(), default: { pool: vi.fn() } }));

import { logSeLenta, SLOW_QUERY_MS } from '../database/firebird/pool.js';

describe('log de query lenta do Firebird', () => {
  it('loga só acima do limite, com SQL compactado e sem parâmetros', () => {
    logSeLenta('SELECT 1', performance.now(), 'query');
    expect(warn).not.toHaveBeenCalled();

    logSeLenta('SELECT   *\n FROM ORDEMSERVICO', performance.now() - SLOW_QUERY_MS - 1, 'transacao');
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ sql: 'SELECT * FROM ORDEMSERVICO', contexto: 'transacao' }),
      'Query Firebird lenta',
    );
  });
});
