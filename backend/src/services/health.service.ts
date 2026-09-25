import { sql } from 'drizzle-orm';
import { firebirdQuery } from '../database/firebird/pool.js';
import { db } from '../database/postgres/client.js';
import { APP_VERSION } from '../config/version.js';
import { getCherpMode } from '../repositories/cherpMode.js';

type Componente = 'ok' | 'down';

function comTimeout<T>(promessa: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promessa.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

async function checar(teste: () => Promise<unknown>): Promise<Componente> {
  try {
    await comTimeout(teste(), 3000);
    return 'ok';
  } catch {
    return 'down';
  }
}

/**
 * Postgres fora = a API não funciona (login, sessão). Firebird fora = login funciona mas OS/clientes não:
 * fica "degraded". Em modo mock o Firebird nem é consultado.
 */
export async function getHealthStatus() {
  const cherpMode = getCherpMode();
  const [postgres, firebird] = await Promise.all([
    checar(() => db.execute(sql`SELECT 1`)),
    cherpMode === 'firebird' ? checar(() => firebirdQuery('SELECT 1 FROM RDB$DATABASE')) : Promise.resolve<Componente | 'mock'>('mock'),
  ]);

  const status = postgres === 'down' ? ('down' as const) : firebird === 'down' ? ('degraded' as const) : ('ok' as const);
  return { status, timestamp: new Date().toISOString(), version: APP_VERSION, postgres, firebird, cherpMode };
}
