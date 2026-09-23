import type { Request, Response } from 'express';
import * as sessionService from '../services/session.service.js';
import { getResumoLicenca } from '../services/license.service.js';
import { success } from '../utils/apiResponse.js';
import { requestContext } from '../utils/requestContext.js';

export async function listSessionsHandler(_req: Request, res: Response) {
  success(res, await sessionService.listActiveSessions());
}

export async function forceLogoutSessionHandler(req: Request, res: Response) {
  await sessionService.forceLogoutSession(req.params.id as string, req.user!, requestContext(req));
  success(res, null, 'Sessão encerrada.');
}

export async function forceLogoutAllHandler(req: Request, res: Response) {
  await sessionService.forceLogoutAllForUser(req.params.userId as string, req.user!, requestContext(req));
  success(res, null, 'Sessões encerradas.');
}

/** Painel de licença (Configurações > Sobre): quantas vagas em uso e quem está online. */
export async function getLicenseHandler(_req: Request, res: Response) {
  success(res, await getResumoLicenca());
}
