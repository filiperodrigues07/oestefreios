import { AppError } from './AppError.js';

/**
 * Erro de dependência externa (Firebird/CHERP indisponível, timeout, etc).
 * A mensagem exposta ao cliente é sempre genérica; detalhes técnicos reais
 * (ECONNREFUSED, SQL error) devem ser logados internamente, nunca aqui.
 */
export class ExternalServiceError extends AppError {
  constructor(
    message = 'Não foi possível conectar ao sistema ERP no momento. Tente novamente em alguns instantes.',
    code = 'FIREBIRD_UNAVAILABLE',
  ) {
    super(code, message, 503);
    this.name = 'ExternalServiceError';
  }
}
