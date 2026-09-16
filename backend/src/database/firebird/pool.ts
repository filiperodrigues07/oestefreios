import * as Firebird from 'node-firebird';
import { firebirdOptions } from '../../config/firebird.config.js';
import { ExternalServiceError } from '../../errors/ExternalServiceError.js';
import { logger } from '../../utils/logger.js';
import { decodeLatin1Row } from './encoding.js';
import type { FirebirdRow } from './types.js';

/**
 * Pool de conexões Firebird, promisificado. NÃO usado até a Fase 5 — os
 * repositories CHERP rodam em modo mock (ver `repositories/mock/`) até as
 * queries reais serem fornecidas.
 */
let currentOptions: Firebird.Options = { ...firebirdOptions };
let cachedPool: Firebird.ConnectionPool | null = null;

function getPool(): Firebird.ConnectionPool {
  if (!cachedPool) {
    cachedPool = Firebird.pool(10, currentOptions);
  }
  return cachedPool;
}

/**
 * Troca as credenciais/host/charset do Firebird em tempo real (tela de Configurações, aba
 * Firebird) — sem reiniciar o processo. Descarta o pool atual (conexões idle são fechadas;
 * a próxima `firebirdQuery`/`firebirdTransaction` recria o pool já com as opções novas).
 */
export function reloadFirebirdPool(newOptions: Partial<Firebird.Options>): Promise<void> {
  currentOptions = { ...currentOptions, ...newOptions };
  const old = cachedPool;
  cachedPool = null;
  if (!old) return Promise.resolve();
  return new Promise((resolve) => old.destroy(() => resolve()));
}

/**
 * node-firebird devolve array pra SELECT normal, mas um objeto único (não array)
 * pra INSERT/UPDATE/DELETE ... RETURNING de uma linha só — normaliza os dois casos.
 */
function asRows(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  if (result && typeof result === 'object') return [result as Record<string, unknown>];
  return [];
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
        resolve(asRows(result).map(decodeLatin1Row) as T[]);
      });
    });
  });
}

/**
 * Roda várias escritas relacionadas (ex.: criar OS + itens) em uma única transação
 * Firebird — tudo confirma junto ou nada fica gravado. `fn` recebe uma função `query`
 * presa a essa transação; use-a em vez de `firebirdQuery` para cada passo.
 */
export async function firebirdTransaction<T>(
  fn: (query: <R = FirebirdRow>(sql: string, params?: unknown[]) => Promise<R[]>) => Promise<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    getPool().get((connErr, db) => {
      if (connErr) {
        logger.error({ err: connErr }, 'Falha ao obter conexão Firebird');
        return reject(new ExternalServiceError());
      }
      db.transaction(Firebird.ISOLATION_READ_COMMITTED, (trErr, transaction) => {
        if (trErr) {
          db.detach();
          logger.error({ err: trErr }, 'Falha ao abrir transação Firebird');
          return reject(new ExternalServiceError());
        }

        const query = <R = FirebirdRow>(sql: string, params: unknown[] = []): Promise<R[]> =>
          new Promise((res, rej) => {
            transaction.query(sql, params, (queryErr, result) => {
              if (queryErr) return rej(queryErr);
              res(asRows(result).map(decodeLatin1Row) as R[]);
            });
          });

        fn(query).then(
          (value) => {
            transaction.commit((commitErr) => {
              db.detach();
              if (commitErr) {
                logger.error({ err: commitErr }, 'Falha ao confirmar transação Firebird');
                return reject(new ExternalServiceError());
              }
              resolve(value);
            });
          },
          (fnErr) => {
            transaction.rollback(() => {
              db.detach();
              logger.error({ err: fnErr }, 'Transação Firebird revertida por erro');
              reject(fnErr instanceof Error ? fnErr : new ExternalServiceError());
            });
          },
        );
      });
    });
  });
}
