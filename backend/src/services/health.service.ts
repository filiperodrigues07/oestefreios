import { sql } from 'drizzle-orm';
import { db } from '../database/postgres/client.js';
import { getCherpMode } from '../repositories/cherpMode.js';

export async function getHealthStatus() {
  let postgres: 'ok' | 'down';
  try {
    await db.execute(sql`SELECT 1`);
    postgres = 'ok';
  } catch {
    postgres = 'down';
  }

  return {
    status: 'ok' as const,
    timestamp: new Date().toISOString(),
    postgres,
    cherpMode: getCherpMode(),
  };
}
