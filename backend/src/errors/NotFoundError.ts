import { AppError } from './AppError.js';

export class NotFoundError extends AppError {
  constructor(message = 'Recurso não encontrado.', code = 'NOT_FOUND') {
    super(code, message, 404);
    this.name = 'NotFoundError';
  }
}
