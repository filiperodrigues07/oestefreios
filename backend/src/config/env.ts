import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  FRONTEND_URL: z.url().default('http://localhost:5173'),

  /**
   * 'mock' (default): repositories/mock/* em memória, sem depender do Firebird.
   * 'firebird': repositories/firebird/*, que exigem as queries reais (Fase 5) já
   * preenchidas em cada arquivo — ver database/queries/CONTRATO.md.
   */
  CHERP_MODE: z.enum(['mock', 'firebird']).default('mock'),
  FIREBIRD_HOST: z.string().default('localhost'),
  FIREBIRD_PORT: z.coerce.number().int().positive().default(3050),
  FIREBIRD_DATABASE: z.string().default(''),
  FIREBIRD_USER: z.string().default('SYSDBA'),
  FIREBIRD_PASSWORD: z.string().default(''),
  /** CHAVE (USUARIOS) do CHERP registrado como responsável por toda OS aberta/fechada pelo app. */
  FIREBIRD_OS_USUARIO_CHAVE: z.coerce.number().int().positive().default(2),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatório'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter ao menos 32 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET deve ter ao menos 32 caracteres'),
  SETTINGS_ENCRYPTION_KEY: z.string().min(32, 'SETTINGS_ENCRYPTION_KEY deve ter ao menos 32 caracteres').optional(),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  DEV_ADMIN_EMAIL: z.email().default('admin@dev.local'),
  DEV_ADMIN_PASSWORD: z.string().min(8).default('Admin@123456'),
  DADOS_API_TOKEN: z.string().trim().optional(),
  DADOS_API_BASE_URL: z.url().default('https://api.dadosapi.com'),
  VEHICLE_LOOKUP_MONTHLY_LIMIT: z.coerce.number().int().nonnegative().default(50),
  VEHICLE_LOOKUP_CACHE_TTL_DAYS: z.coerce.number().int().positive().default(30),
}).superRefine((value, ctx) => {
  if (value.NODE_ENV === 'production' && !value.SETTINGS_ENCRYPTION_KEY) {
    ctx.addIssue({ code: 'custom', path: ['SETTINGS_ENCRYPTION_KEY'], message: 'Obrigatória em produção.' });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variáveis de ambiente inválidas:');
  console.error(z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
