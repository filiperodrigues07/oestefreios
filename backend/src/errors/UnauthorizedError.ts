import { AppError } from './AppError.js';

export class UnauthorizedError extends AppError {
  constructor(message = 'Credenciais inválidas.', code = 'UNAUTHORIZED') {
    super(code, message, 401);
    this.name = 'UnauthorizedError';
  }
}
