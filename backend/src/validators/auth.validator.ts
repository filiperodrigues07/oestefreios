import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'A senha precisa ter ao menos 8 caracteres.'),
});

export const updateMyProfileSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório.'),
  email: z.email('E-mail inválido.'),
});
