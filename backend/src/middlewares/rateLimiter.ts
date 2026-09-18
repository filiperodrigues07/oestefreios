import rateLimit from 'express-rate-limit';
import { failure } from '../utils/apiResponse.js';

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => failure(res, 'RATE_LIMITED', 'Muitas requisições. Tente novamente em instantes.', 429),
});

/** Limiter mais agressivo para rotas sensíveis de autenticação (credencial adivinhável por força bruta). */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_req, res) =>
    failure(res, 'RATE_LIMITED', 'Muitas tentativas de login. Tente novamente em instantes.', 429),
});

/**
 * Limiter próprio pra /auth/refresh — não pode compartilhar orçamento com o login. O refresh token
 * tem 256 bits de entropia (não é adivinhável por força bruta) e o front chama essa rota a cada
 * carregamento de página pra restaurar sessão (bootstrapSession); um cookie ausente/expirado gera
 * um 401 legítimo e comum, que não deveria consumir a mesma cota de 5 tentativas do login.
 */
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_req, res) => failure(res, 'RATE_LIMITED', 'Muitas requisições. Tente novamente em instantes.', 429),
});
