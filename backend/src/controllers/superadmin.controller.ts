import type { Request, Response } from 'express';
import { getLicencaConfigDetalhada, salvarLicencaConfig } from '../services/license.service.js';
import { recordAudit } from '../services/auditLog.service.js';
import { success } from '../utils/apiResponse.js';
import { requestContext } from '../utils/requestContext.js';

export async function getLicencaConfigHandler(_req: Request, res: Response) {
  success(res, await getLicencaConfigDetalhada());
}

export async function saveLicencaConfigHandler(req: Request, res: Response) {
  const antes = await getLicencaConfigDetalhada();
  const salvo = await salvarLicencaConfig(req.body);
  await recordAudit({
    userId: req.user!.id,
    userName: req.user!.name,
    event: 'LICENSE_UPDATED',
    entityType: 'LICENSE',
    entityId: 'LICENSE_UPDATED',
    changes: { before: { limite: antes.limite, idleMinutes: antes.idleMinutes, sessaoUnica: antes.sessaoUnica }, after: req.body },
    ...requestContext(req),
  });
  success(res, salvo, 'Configuração de licenças salva. Vale a partir do próximo login.');
}
