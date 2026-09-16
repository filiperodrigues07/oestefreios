import type { Request, Response } from 'express';
import * as settingsService from '../services/settings.service.js';
import { success } from '../utils/apiResponse.js';

export async function getFirebirdSettingsHandler(_req: Request, res: Response) {
  const data = await settingsService.getFirebirdSettingsMasked();
  success(res, data);
}

export async function saveFirebirdSettingsHandler(req: Request, res: Response) {
  await settingsService.saveFirebirdSettings(req.body);
  const data = await settingsService.getFirebirdSettingsMasked();
  success(res, data, 'Configurações do Firebird salvas.');
}

export async function testFirebirdSettingsHandler(req: Request, res: Response) {
  const result = await settingsService.testFirebirdConnection(req.body);
  success(res, result);
}

export async function getSmtpSettingsHandler(_req: Request, res: Response) {
  const data = await settingsService.getSmtpSettingsMasked();
  success(res, data);
}

export async function saveSmtpSettingsHandler(req: Request, res: Response) {
  await settingsService.saveSmtpSettings(req.body);
  const data = await settingsService.getSmtpSettingsMasked();
  success(res, data, 'Configurações de e-mail salvas.');
}

export async function testSmtpSettingsHandler(req: Request, res: Response) {
  const { destino, smtp } = req.body as { destino: string; smtp: Parameters<typeof settingsService.sendTestEmail>[0] };
  const result = await settingsService.sendTestEmail(smtp, destino);
  success(res, result);
}

/** Nome/logo do cliente pro cabeçalho da sidebar — qualquer usuário autenticado pode ler, não é dado sensível. */
export async function getBrandingHandler(_req: Request, res: Response) {
  const geral = await settingsService.getGeralSettings();
  success(res, { nomeEmpresa: geral.nomeEmpresa, logoUrl: geral.logoUrl });
}

export async function getGeralSettingsHandler(_req: Request, res: Response) {
  const data = await settingsService.getGeralSettings();
  success(res, data);
}

export async function saveGeralSettingsHandler(req: Request, res: Response) {
  await settingsService.saveGeralSettings(req.body);
  const data = await settingsService.getGeralSettings();
  success(res, data, 'Configurações gerais salvas.');
}
