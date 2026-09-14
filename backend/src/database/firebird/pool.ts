import Firebird from 'node-firebird';
import { firebirdOptions } from '../../config/firebird.config.js';
import { ExternalServiceError } from '../../errors/ExternalServiceError.js';
import { logger } from '../../utils/logger.js';
import type { FirebirdRow } from './types.js';

/**
 * Pool de conexões Firebird, promisificado. NÃO usado até a Fase 5 — os
 * repositories CHERP rodam em modo mock (ver `repositories/mock/`) até as
 * queries reais serem fornecidas.
 */
let cachedPool: Firebird.ConnectionPool | null = null;

function getPool(): Firebird.ConnectionPool {
  if (!cachedPool) {
    cachedPool = Firebird.pool(10, firebirdOptions);
  }
  return cachedPool;
}

export async function firebirdQuery<T = FirebirdRow>(sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    getPool().get((err, db) => {
      if (err) {
        logger.error({ err }, 'Falha ao obter conexão Firebird');
        return reject(new ExternalServiceError());
      }
      db.query(sql, params, (queryErr, result) => {
        db.detach();
        if (queryErr) {
          logger.error({ err: queryErr }, 'Falha ao executar query Firebird');
          return reject(new ExternalServiceError());
        }
        resolve(result as T[]);
      });
    });
  });
}
