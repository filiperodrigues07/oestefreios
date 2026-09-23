import type { Request, Response } from 'express';
import * as billingService from '../services/billing.service.js';
import { success } from '../utils/apiResponse.js';
import { requestContext } from '../utils/requestContext.js';

export async function getBillingHandler(_req: Request, res: Response) {
  success(res, await billingService.getBillingCompleto());
}

/** Qualquer usuário logado: só o estado e a mensagem, sem valor nem histórico. */
export async function getBillingStatusHandler(_req: Request, res: Response) {
  success(res, await billingService.getBillingStatus());
}

export async function updateBillingHandler(req: Request, res: Response) {
  success(res, await billingService.atualizarBilling(req.body, req.user!, requestContext(req)), 'Assinatura atualizada.');
}

export async function addPaymentHandler(req: Request, res: Response) {
  success(res, await billingService.registrarPagamento(req.body, req.user!, requestContext(req)), 'Pagamento registrado.');
}

export async function removePaymentHandler(req: Request, res: Response) {
  success(res, await billingService.removerPagamento(req.params.id as string, req.user!, requestContext(req)), 'Pagamento removido.');
}
