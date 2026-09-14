import rateLimit from 'express-rate-limit';
import { failure } from '../utils/apiResponse.js';

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => failure(res, 'RATE_LIMITED', 'Muitas requisições. Tente novamente em instantes.', 429),
});

/** Limiter mais agressivo para rotas sensíveis de autenticação. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_req, res) =>
    failure(res, 'RATE_LIMITED', 'Muitas tentativas de login. Tente novamente em instantes.', 429),
});
