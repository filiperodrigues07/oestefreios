import { Router } from 'express';
import {
  getBrandingHandler,
  getFirebirdSettingsHandler,
  getFirebirdConnectionStatusHandler,
  getGeralSettingsHandler,
  getIntegracoesSettingsHandler,
  getSmtpSettingsHandler,
  saveFirebirdSettingsHandler,
  saveGeralSettingsHandler,
  saveIntegracoesSettingsHandler,
  saveSmtpSettingsHandler,
  testFirebirdSettingsHandler,
  testSmtpSettingsHandler,
} from '../controllers/settings.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import { getSistemaStatus } from '../services/sistema.service.js';
import { createEvolutionInstance, getEvolutionConnection, getEvolutionQr } from '../services/evolution.service.js';
import { getWhatsappSettingsMasked, saveWhatsappSettings, whatsappSettingsSchema } from '../services/whatsappSettings.service.js';
import { requestContext } from '../utils/requestContext.js';
import {
  firebirdSettingsSchema,
  geralSettingsSchema,
  integracoesSettingsSchema,
  smtpSettingsSchema,
  testEmailSchema,
} from '../validators/settings.validator.js';

export const settingsRouter = Router();

// Nome/logo do cliente: qualquer usuário logado precisa pra a sidebar, não é dado sensível de sistema.
settingsRouter.get('/branding', authenticate, asyncHandler(getBrandingHandler));

// Configurações técnicas (Firebird/SMTP/Geral) são dado sensível de sistema — só SYSTEM_SETTINGS.
// Senhas e chaves salvas nunca voltam em texto puro (só a máscara): sessão de admin roubada não leva a
// senha do CHERP/SMTP junto. Pra trocar, o admin digita a nova; salvar com a máscara mantém a atual.
settingsRouter.use(authenticate, requirePermission('SYSTEM_SETTINGS'));

settingsRouter.get('/sistema', asyncHandler(async (_req, res) => success(res, await getSistemaStatus())));
settingsRouter.get('/firebird', asyncHandler(getFirebirdSettingsHandler));
settingsRouter.get('/firebird/status', asyncHandler(getFirebirdConnectionStatusHandler));
settingsRouter.put('/firebird', validate(firebirdSettingsSchema), asyncHandler(saveFirebirdSettingsHandler));
settingsRouter.post('/firebird/test', validate(firebirdSettingsSchema), asyncHandler(testFirebirdSettingsHandler));

settingsRouter.get('/smtp', asyncHandler(getSmtpSettingsHandler));
settingsRouter.put('/smtp', validate(smtpSettingsSchema), asyncHandler(saveSmtpSettingsHandler));
settingsRouter.post('/smtp/test', validate(testEmailSchema), asyncHandler(testSmtpSettingsHandler));

settingsRouter.get('/geral', asyncHandler(getGeralSettingsHandler));
settingsRouter.put('/geral', validate(geralSettingsSchema), asyncHandler(saveGeralSettingsHandler));

settingsRouter.get('/integracoes', asyncHandler(getIntegracoesSettingsHandler));
settingsRouter.put('/integracoes', validate(integracoesSettingsSchema), asyncHandler(saveIntegracoesSettingsHandler));

settingsRouter.get('/whatsapp', asyncHandler(async (_req, res) => success(res, await getWhatsappSettingsMasked())));
settingsRouter.put('/whatsapp', validate(whatsappSettingsSchema), asyncHandler(async (req, res) => {
  await saveWhatsappSettings(req.body, req.user!, requestContext(req));
  success(res, await getWhatsappSettingsMasked(), 'WhatsApp configurado.');
}));
settingsRouter.get('/whatsapp/status', asyncHandler(async (_req, res) => success(res, await getEvolutionConnection())));
settingsRouter.get('/whatsapp/qr', asyncHandler(async (_req, res) => success(res, await getEvolutionQr())));
settingsRouter.post('/whatsapp/instance', asyncHandler(async (_req, res) => {
  await createEvolutionInstance();
  success(res, null, 'Instância criada. Agora conecte o WhatsApp pelo QR Code.', 201);
}));
