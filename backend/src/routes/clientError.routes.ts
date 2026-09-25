import { Router, type Request, type Response } from 'express';
import { clientErrorLimiter } from '../middlewares/rateLimiter.js';
import { validate } from '../middlewares/validate.js';
import { clientErrorSchema, type ClientErrorInput } from '../validators/clientError.validator.js';
import { logger } from '../utils/logger.js';

export const clientErrorRouter = Router();

/**
 * Erros de tela do navegador (ErrorBoundary, window.onerror, promise rejeitada) viram log do backend —
 * você fica sabendo do erro antes do cliente ligar. Público de propósito (erro pode acontecer antes do
 * login), por isso limite por IP e payload cortado; nada vai pro banco, só pro log.
 */
clientErrorRouter.post('/', clientErrorLimiter, validate(clientErrorSchema), (req: Request, res: Response) => {
  const erro = req.body as ClientErrorInput;
  logger.error(
    { clientError: erro, requestId: req.requestId, ip: req.ip, userAgent: req.get('user-agent') },
    'Erro no frontend',
  );
  res.status(204).end();
});
