export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly isOperational: boolean;
  /** Payload estruturado opcional pro cliente (ex.: registro conflitante num erro de duplicidade). */
  readonly details?: unknown;

  constructor(code: string, message: string, statusCode: number, isOperational = true, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}
