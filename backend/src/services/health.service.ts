import { sql } from 'drizzle-orm';
import { env } from '../config/env.js';
import { db } from '../database/postgres/client.js';

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
    cherpMode: env.CHERP_MODE,
  };
}
