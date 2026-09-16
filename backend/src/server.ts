import { app } from './app.js';
import { env } from './config/env.js';
import { pool } from './database/postgres/client.js';
import { applyStoredFirebirdSettings } from './services/settings.service.js';
import { logger } from './utils/logger.js';

const server = app.listen(env.PORT, () => {
  logger.info(`Backend rodando em http://localhost:${env.PORT} (${env.NODE_ENV})`);
  logger.info(`Swagger em http://localhost:${env.PORT}/api/docs`);
});

// Se já existir configuração de Firebird salva via tela de Configurações, ela prevalece
// sobre o .env a partir daqui (ver services/settings.service.ts).
applyStoredFirebirdSettings().catch((err) => {
  logger.warn({ err }, 'Não foi possível aplicar configurações salvas do Firebird — mantendo .env');
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
