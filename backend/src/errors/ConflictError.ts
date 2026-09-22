import { AppError } from './AppError.js';

/** Registro já existe (CPF/CNPJ, placa, etc.) — usado pelas checagens de duplicidade antes do insert. */
export class ConflictError extends AppError {
  constructor(message = 'Registro já existe.', code = 'CONFLICT', details?: unknown) {
    super(code, message, 409, true, details);
    this.name = 'ConflictError';
  }
}
