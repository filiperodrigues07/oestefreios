import type { Response } from 'express';
import type { ApiErrorResponse, ApiSuccessResponse } from '../types/api.types.js';

export function success<T>(res: Response, data: T, message: string | null = null, statusCode = 200) {
  const body: ApiSuccessResponse<T> = { success: true, data, message };
  return res.status(statusCode).json(body);
}

export function failure(res: Response, code: string, message: string, statusCode: number, details?: unknown) {
  const body: ApiErrorResponse = { success: false, error: { code, message, details } };
  return res.status(statusCode).json(body);
}
