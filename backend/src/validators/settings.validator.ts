import { z } from 'zod';

export const firebirdSettingsSchema = z.object({
  host: z.string().trim().min(1),
  port: z.coerce.number().int().positive(),
  database: z.string().trim().min(1),
  user: z.string().trim().min(1),
  password: z.string(),
  charset: z.string().trim().min(1),
});

export const smtpSettingsSchema = z.object({
  host: z.string().trim(),
  port: z.coerce.number().int().positive(),
  seguranca: z.enum(['nenhuma', 'starttls', 'ssl']),
  user: z.string().trim(),
  password: z.string(),
  fromEmail: z.string().trim(),
  fromName: z.string().trim(),
});

export const geralSettingsSchema = z.object({
  nomeEmpresa: z.string().trim().min(1),
  logoUrl: z.string().trim().max(2_000_000),
  corDestaque: z.string().trim(),
  fusoHorario: z.string().trim().min(1),
});

export const testEmailSchema = z.object({
  destino: z.email(),
  smtp: smtpSettingsSchema,
});
