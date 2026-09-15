import type { Request, Response } from 'express';
import * as auditLogService from '../services/auditLog.service.js';
import { success } from '../utils/apiResponse.js';

export async function listAuditLogsHandler(req: Request, res: Response) {
  const filter = req.query as unknown as { entityType?: string; event?: string; page: number; limit: number };
  const result = await auditLogService.listAuditLogs(filter, req.user!.permissions);
  success(res, result);
}
