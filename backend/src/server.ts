import { app } from './app.js';
import { env } from './config/env.js';
import { pool } from './database/postgres/client.js';
import { logger } from './utils/logger.js';

const server = app.listen(env.PORT, () => {
  logger.info(`Backend rodando em http://localhost:${env.PORT} (${env.NODE_ENV})`);
  logger.info(`Swagger em http://localhost:${env.PORT}/api/docs`);
});

async function shutdown(signal: string) {
  logger.info(`Recebido ${signal}, encerrando graciosamente...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
