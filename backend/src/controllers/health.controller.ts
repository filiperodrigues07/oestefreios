import type { Request, Response } from 'express';
import { getHealthStatus } from '../services/health.service.js';
import { success } from '../utils/apiResponse.js';

export async function healthHandler(_req: Request, res: Response) {
  const status = await getHealthStatus();
  success(res, status);
}
