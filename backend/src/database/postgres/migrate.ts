import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './client.js';

async function main() {
  console.log('Rodando migrations...');
  await migrate(db, { migrationsFolder: './src/database/migrations' });
  console.log('Migrations aplicadas com sucesso.');
  await pool.end();
}

main().catch((err) => {
  console.error('Falha ao rodar migrations:', err);
  process.exit(1);
});
