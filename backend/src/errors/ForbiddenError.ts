import { AppError } from './AppError.js';

export class ForbiddenError extends AppError {
  constructor(message = 'Você não tem permissão para executar esta ação.') {
    super('FORBIDDEN', message, 403);
    this.name = 'ForbiddenError';
  }
}
