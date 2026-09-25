import type { Request, Response } from 'express';
import { getHealthStatus } from '../services/health.service.js';
import { success } from '../utils/apiResponse.js';

export async function healthHandler(_req: Request, res: Response) {
  const status = await getHealthStatus();
  // 503 só quando a API não consegue operar (Postgres fora) — monitores de uptime e balanceadores reagem ao código.
  if (status.status === 'down') res.status(503);
  success(res, status);
}
