import type { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
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

/** Por usuário logado (ou IP, se ainda não houver) — o abuso é da conta, não do endereço. */
const chavePorUsuario = (req: Request) => req.user?.id ?? ipKeyGenerator(req.ip ?? '');

/**
 * Consultas externas (CNPJ, CEP, inscrição estadual, placa): cada chamada gasta cota de API paga ou de terceiros,
 * então um único usuário não pode esgotá-la. Deve vir DEPOIS do authenticate.
 */
export const consultaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: chavePorUsuario,
  handler: (_req, res) => failure(res, 'RATE_LIMITED', 'Muitas consultas em pouco tempo. Aguarde alguns minutos.', 429),
});

/** Relatórios, exportações e PDFs: consultas pesadas ao CHERP e geração de arquivo em memória. */
export const exportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: chavePorUsuario,
  handler: (_req, res) => failure(res, 'RATE_LIMITED', 'Muitas exportações em pouco tempo. Aguarde alguns minutos.', 429),
});

/**
 * "Esqueci a senha" tem orçamento próprio (não divide com o login): sempre responde sucesso, então o
 * skipSuccessfulRequests não serve. Um limite por IP e outro por e-mail evitam spam de e-mail para a caixa de alguém.
 */
export const esqueciSenhaIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => failure(res, 'RATE_LIMITED', 'Muitas solicitações. Tente novamente mais tarde.', 429),
});

export const esqueciSenhaEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `email:${String((req.body as { email?: unknown } | undefined)?.email ?? '').trim().toLowerCase()}`,
  handler: (_req, res) => failure(res, 'RATE_LIMITED', 'Muitas solicitações para este e-mail. Tente novamente mais tarde.', 429),
});
