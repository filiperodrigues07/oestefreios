import { env } from './env.js';

/**
 * Opções de conexão do node-firebird, derivadas do ambiente.
 * Não usado até a Fase 5 do roadmap — repositórios CHERP rodam em modo mock
 * até as queries reais serem fornecidas. Ver `database/firebird/pool.ts`.
 */
export const firebirdOptions = {
  host: env.FIREBIRD_HOST,
  port: env.FIREBIRD_PORT,
  database: env.FIREBIRD_DATABASE,
  user: env.FIREBIRD_USER,
  password: env.FIREBIRD_PASSWORD,
  lowercase_keys: false,
  pageSize: 4096,
  // Fotos usam BLOBs grandes; blocos de 1 KB causam milhares de viagens pela rede ao CHERP.
  blobChunkSize: 65_535,
  blobReadChunkSize: 65_535,
  connectTimeout: 8_000,
};
