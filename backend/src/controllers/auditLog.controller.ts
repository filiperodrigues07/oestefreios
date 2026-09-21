import type { Request, Response } from 'express';
import * as auditLogService from '../services/auditLog.service.js';
import { success } from '../utils/apiResponse.js';
import { exportarExcel } from '../services/reportExport.service.js';
import { getGeralSettings } from '../services/settings.service.js';

export async function listAuditLogsHandler(req: Request, res: Response) {
  const filter = req.query as unknown as auditLogService.AuditLogFilter & { formato: 'json' | 'excel' };
  if (filter.formato === 'excel') {
    const relatorio = await auditLogService.exportAuditLogs(filter);
    const geral = await getGeralSettings();
    const buffer = await exportarExcel(relatorio, { nomeEmpresa: geral.nomeEmpresa, logoUrl: geral.logoUrl, corDestaque: geral.corDestaque });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="auditoria.xlsx"');
    res.send(buffer);
    return;
  }
  const result = await auditLogService.listAuditLogs(filter, req.user!.permissions);
  success(res, result);
}
