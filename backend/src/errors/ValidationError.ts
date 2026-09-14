import { AppError } from './AppError.js';

export class ValidationError extends AppError {
  constructor(message = 'Dados inválidos.') {
    super('VALIDATION_ERROR', message, 400);
    this.name = 'ValidationError';
  }
}
