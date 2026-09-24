import type { Request, Response } from 'express';
import * as billingService from '../services/billing.service.js';
import * as cobrancaService from '../services/cobranca.service.js';
import { ValidationError } from '../errors/ValidationError.js';
import { success } from '../utils/apiResponse.js';
import { requestContext } from '../utils/requestContext.js';

export async function getBillingHandler(_req: Request, res: Response) {
  success(res, await billingService.getBillingCompleto());
}

/** Qualquer usuário logado. O proprietário vê o estado real; os demais só veem "modo consulta" (ou nada). */
export async function getBillingStatusHandler(req: Request, res: Response) {
  const status = await billingService.getBillingStatus();
  success(res, req.user!.isSuperAdmin ? status : billingService.statusParaCliente(status));
}

export async function controlBillingHandler(req: Request, res: Response) {
  success(res, await billingService.controlarAssinatura(req.body, req.user!, requestContext(req)), 'Controle da assinatura atualizado.');
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

export async function createCobrancaHandler(req: Request, res: Response) {
  if (!req.file) throw new ValidationError('Anexe o PDF do boleto.');
  const cobranca = await cobrancaService.criarCobranca(req.body, req.file, req.user!, requestContext(req));
  success(res, cobranca, 'Cobrança criada.', 201);
}

export async function downloadCobrancaHandler(req: Request, res: Response) {
  const { nome, buffer } = await cobrancaService.arquivoDaCobranca(req.params.id as string);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(buffer);
}

export async function removeCobrancaHandler(req: Request, res: Response) {
  await cobrancaService.removerCobranca(req.params.id as string, req.user!, requestContext(req));
  success(res, null, 'Cobrança removida.');
}

export async function sendCobrancaHandler(req: Request, res: Response) {
  const cobranca = await cobrancaService.enviarCobranca(req.params.id as string, req.body, req.user!, requestContext(req));
  success(res, cobranca, 'Boleto enviado por e-mail.');
}

export async function getCobrancaConfigHandler(_req: Request, res: Response) {
  success(res, await cobrancaService.getCobrancaSettingsMasked());
}

export async function saveCobrancaConfigHandler(req: Request, res: Response) {
  success(res, await cobrancaService.saveCobrancaSettings(req.body, req.user!, requestContext(req)), 'E-mail de cobrança salvo.');
}

export async function getCobrancaSmtpPasswordHandler(_req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  success(res, { password: await cobrancaService.getCobrancaSmtpPassword() });
}

export async function testCobrancaSmtpHandler(req: Request, res: Response) {
  success(res, await cobrancaService.testarSmtpCobranca((req.body as { destino: string }).destino));
}
