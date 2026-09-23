import { randomUUID } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Request, Response } from 'express';
import * as settingsService from '../services/settings.service.js';
import { success } from '../utils/apiResponse.js';
import { detectarTipoImagem } from '../utils/imageSignature.js';
import { requestContext } from '../utils/requestContext.js';

const MAX_LOGO_BYTES = 1024 * 1024;

/** Se `logoUrl` vier como data URI (upload novo do front), grava em disco e devolve o caminho servido. Caso contrário (já é um caminho salvo ou vazio), mantém como está. */
async function resolverLogoUrl(logoUrl: string): Promise<string> {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(logoUrl);
  if (!match) return logoUrl;
  const content = Buffer.from(match[2]!, 'base64');
  const tipo = detectarTipoImagem(content);
  if (!tipo || content.length === 0 || content.length > MAX_LOGO_BYTES) {
    throw new Error('A logo deve ter no máximo 1 MB e estar em formato PNG, JPEG ou WebP.');
  }
  const directory = resolve(process.cwd(), 'uploads', 'branding');
  await mkdir(directory, { recursive: true });
  const filename = `logo-${randomUUID()}.${tipo.extensao}`;
  const finalPath = resolve(directory, filename);
  const tempPath = `${finalPath}.tmp`;
  await writeFile(tempPath, content, { flag: 'wx' });
  await rename(tempPath, finalPath);
  return `/api/uploads/branding/${filename}`;
}

export async function getFirebirdSettingsHandler(_req: Request, res: Response) {
  const data = await settingsService.getFirebirdSettingsMasked();
  success(res, data);
}

export async function getFirebirdPasswordHandler(_req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  success(res, { password: await settingsService.getFirebirdPassword() });
}

export async function getFirebirdConnectionStatusHandler(_req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  success(res, await settingsService.getFirebirdConnectionStatus());
}

export async function saveFirebirdSettingsHandler(req: Request, res: Response) {
  const { cherpMode } = await settingsService.saveFirebirdSettings(req.body, req.user!, requestContext(req));
  const data = await settingsService.getFirebirdSettingsMasked();
  const mensagem = cherpMode === 'firebird'
    ? 'Configurações do Firebird salvas. Conexão confirmada — o sistema já está usando dados reais do CHERP.'
    : 'Configurações do Firebird salvas, mas não foi possível confirmar a conexão — revise os dados e teste novamente.';
  success(res, { ...data, cherpMode }, mensagem);
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
  await settingsService.saveSmtpSettings(req.body, req.user!, requestContext(req));
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
  success(res, { nomeEmpresa: geral.nomeEmpresa, logoUrl: geral.logoUrl, corDestaque: geral.corDestaque });
}

export async function getGeralSettingsHandler(_req: Request, res: Response) {
  const data = await settingsService.getGeralSettings();
  success(res, data);
}

export async function saveGeralSettingsHandler(req: Request, res: Response) {
  const body = req.body as Awaited<ReturnType<typeof settingsService.getGeralSettings>>;
  const logoUrl = await resolverLogoUrl(body.logoUrl);
  await settingsService.saveGeralSettings({ ...body, logoUrl }, req.user!, requestContext(req));
  const data = await settingsService.getGeralSettings();
  success(res, data, 'Configurações gerais salvas.');
}

export async function getIntegracoesSettingsHandler(_req: Request, res: Response) {
  const data = await settingsService.getIntegracoesSettingsMasked();
  success(res, data);
}

export async function saveIntegracoesSettingsHandler(req: Request, res: Response) {
  await settingsService.saveIntegracoesSettings(req.body, req.user!, requestContext(req));
  const data = await settingsService.getIntegracoesSettingsMasked();
  success(res, data, 'Integrações salvas.');
}

export async function getIntegrationSecretHandler(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  const { key } = req.params as { key: 'dadosApiToken' | 'sintegraApiKey' };
  success(res, { value: await settingsService.getIntegrationSecret(key) });
}
