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
 * Pega uma conexão do pool com retry (2 tentativas extras, backoff 300ms/600ms) só pra falha
 * de conexão (rede instável, Firebird reiniciando) — nunca pra erro de query/negócio, que deve
 * falhar rápido. Falha definitiva depois das tentativas continua virando `ExternalServiceError`.
 */
function acquireConnection(): Promise<Firebird.Database> {
  return new Promise((resolve, reject) => {
    const attempt = (retriesLeft: number, delayMs: number) => {
      getPool().get((err, db) => {
        if (!err) return resolve(db);
        if (retriesLeft <= 0) {
          logger.error({ err }, 'Falha ao obter conexão Firebird (sem mais tentativas)');
          return reject(new ExternalServiceError());
        }
        logger.warn({ err }, `Falha ao obter conexão Firebird — nova tentativa em ${delayMs}ms`);
        setTimeout(() => attempt(retriesLeft - 1, delayMs * 2), delayMs);
      });
    };
    attempt(2, 300);
  });
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

/** Fecha o pool no shutdown (conexões ociosas) — sem isso o processo pode ficar preso esperando o Firebird. */
export function closeFirebirdPool(): Promise<void> {
  const old = cachedPool;
  cachedPool = null;
  if (!old) return Promise.resolve();
  return new Promise((resolve) => old.destroy(() => resolve()));
}

/** Acima disso a query vira `warn` no log — acha gargalo real em vez de chute. */
export const SLOW_QUERY_MS = 500;

/** Loga query lenta com o começo do SQL (sem parâmetros: podem ter dado de cliente). */
export function logSeLenta(sql: string, inicio: number, contexto: string): void {
  const duracaoMs = Math.round(performance.now() - inicio);
  if (duracaoMs < SLOW_QUERY_MS) return;
  logger.warn({ duracaoMs, sql: sql.replace(/\s+/g, ' ').trim().slice(0, 200), contexto }, 'Query Firebird lenta');
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
  const inicio = performance.now();
  const db = await acquireConnection();
  return new Promise((resolve, reject) => {
    db.query(sql, params, (queryErr, result) => {
      db.detach();
      logSeLenta(sql, inicio, 'query');
      if (queryErr) {
        logger.error({ err: queryErr }, 'Falha ao executar query Firebird');
        return reject(new ExternalServiceError());
      }
      resolve(asRows(result).map(decodeLatin1Row) as T[]);
    }, { timeout: 15_000 });
  });
}

/**
 * node-firebird devolve coluna BLOB binária como uma função — chamar essa função dá um
 * `EventEmitter` que precisa ser drenado (`'data'`/`'end'`) pra virar Buffer de verdade.
 * Só chamado depois de `decodeLatin1Row` (que ignora função, não quebra nada) e antes do
 * `detach()`, porque o emitter só é válido enquanto a conexão está aberta.
 */
function drainBlobColumn(row: Record<string, unknown>, column: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const blobFn = row[column];
    if (typeof blobFn !== 'function') {
      resolve();
      return;
    }
    (blobFn as (cb: (err: unknown, name: string, emitter: NodeJS.EventEmitter) => void) => void)((err, _name, emitter) => {
      if (err) {
        reject(err);
        return;
      }
      const chunks: Buffer[] = [];
      emitter.on('data', (chunk: Buffer) => chunks.push(chunk));
      emitter.on('end', () => {
        row[column] = Buffer.concat(chunks);
        resolve();
      });
      emitter.on('error', (emitterErr: unknown) => reject(emitterErr));
    });
  });
}

/**
 * Igual `firebirdQuery`, mas pra SELECTs que trazem uma coluna BLOB binária (ex.:
 * `ORDEMSERVICOIMG.IMG`) — drena o blob de cada linha num `Buffer` de verdade antes de
 * devolver e fechar a conexão. Isolada de `firebirdQuery`/`firebirdTransaction`: nenhum
 * call site existente seleciona BLOB hoje, então não há risco de regressão nos dois.
 */
export async function firebirdQueryWithBlob<T = FirebirdRow>(
  sql: string,
  params: unknown[],
  blobColumn: string,
): Promise<T[]> {
  const inicio = performance.now();
  const db = await acquireConnection();
  return new Promise((resolve, reject) => {
    db.query(sql, params, (queryErr, result) => {
      logSeLenta(sql, inicio, 'query-blob');
      if (queryErr) {
        db.detach();
        logger.error({ err: queryErr }, 'Falha ao executar query Firebird');
        return reject(new ExternalServiceError());
      }
      const rows = asRows(result).map(decodeLatin1Row);
      Promise.all(rows.map((row) => drainBlobColumn(row, blobColumn)))
        .then(() => {
          db.detach();
          resolve(rows as T[]);
        })
        .catch((blobErr) => {
          db.detach();
          logger.error({ err: blobErr }, 'Falha ao ler BLOB do Firebird');
          reject(new ExternalServiceError());
        });
    }, { timeout: 15_000 });
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
  const db = await acquireConnection();
  return new Promise((resolve, reject) => {
    db.transaction(Firebird.ISOLATION_READ_COMMITTED, (trErr, transaction) => {
      if (trErr) {
        db.detach();
        logger.error({ err: trErr }, 'Falha ao abrir transação Firebird');
        return reject(new ExternalServiceError());
      }

      const query = <R = FirebirdRow>(sql: string, params: unknown[] = []): Promise<R[]> =>
        new Promise((res, rej) => {
          const inicio = performance.now();
          transaction.query(sql, params, (queryErr, result) => {
            logSeLenta(sql, inicio, 'transacao');
            if (queryErr) return rej(queryErr);
            res(asRows(result).map(decodeLatin1Row) as R[]);
          }, { timeout: 15_000 });
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
}
