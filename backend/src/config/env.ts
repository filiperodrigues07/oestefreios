import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  FRONTEND_URL: z.url().default('http://localhost:5173'),

  FIREBIRD_HOST: z.string().default('localhost'),
  FIREBIRD_PORT: z.coerce.number().int().positive().default(3050),
  FIREBIRD_DATABASE: z.string().default(''),
  FIREBIRD_USER: z.string().default('SYSDBA'),
  FIREBIRD_PASSWORD: z.string().default(''),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatório'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET deve ter ao menos 16 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET deve ter ao menos 16 caracteres'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  DEV_ADMIN_EMAIL: z.email().default('admin@dev.local'),
  DEV_ADMIN_PASSWORD: z.string().min(8).default('Admin@123456'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variáveis de ambiente inválidas:');
  console.error(z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
