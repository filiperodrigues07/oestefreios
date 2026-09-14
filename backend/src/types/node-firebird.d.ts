/**
 * Declaração ambiente mínima para node-firebird (sem @types oficial).
 * Cobre só a superfície usada por `database/firebird/pool.ts`. Não invocado
 * até a Fase 5 — expandir conforme as queries reais forem integradas.
 */
declare module 'node-firebird' {
  export interface Options {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    lowercase_keys?: boolean;
    pageSize?: number;
  }

  export interface Database {
    query(sql: string, params: unknown[], callback: (err: Error | null, result: unknown) => void): void;
    detach(callback?: (err: Error | null) => void): void;
  }

  export interface ConnectionPool {
    get(callback: (err: Error | null, db: Database) => void): void;
    destroy(): void;
  }

  export function pool(max: number, options: Options): ConnectionPool;
  export function attach(options: Options, callback: (err: Error | null, db: Database) => void): void;
}
