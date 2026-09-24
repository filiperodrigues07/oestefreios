import type { PoolClient } from 'pg';
import { pool } from '../database/postgres/client.js';

/**
 * Vários arquivos de teste mexem na mesma linha global `settings.billing`; como o vitest roda arquivos em
 * paralelo, cada um segura este lock (advisory de sessão no Postgres) do início ao fim para não se atropelarem.
 */
let cliente: PoolClient | null = null;
const CHAVE = 7_420_001;

export async function travarBilling(): Promise<void> {
  cliente = await pool.connect();
  await cliente.query('SELECT pg_advisory_lock($1)', [CHAVE]);
}

export async function soltarBilling(): Promise<void> {
  if (!cliente) return;
  await cliente.query('SELECT pg_advisory_unlock($1)', [CHAVE]);
  cliente.release();
  cliente = null;
}
