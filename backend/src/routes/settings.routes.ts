import { Router } from 'express';
import {
  getBrandingHandler,
  getFirebirdSettingsHandler,
  getFirebirdPasswordHandler,
  getFirebirdConnectionStatusHandler,
  getGeralSettingsHandler,
  getIntegracoesSettingsHandler,
  getSmtpPasswordHandler,
  getSmtpSettingsHandler,
  saveFirebirdSettingsHandler,
  saveGeralSettingsHandler,
  saveIntegracoesSettingsHandler,
  saveSmtpSettingsHandler,
  testFirebirdSettingsHandler,
  testSmtpSettingsHandler,
  getIntegrationSecretHandler,
} from '../controllers/settings.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  firebirdSettingsSchema,
  geralSettingsSchema,
  integracoesSettingsSchema,
  smtpSettingsSchema,
  testEmailSchema,
  integrationSecretParamSchema,
} from '../validators/settings.validator.js';

export const settingsRouter = Router();

// Nome/logo do cliente: qualquer usuário logado precisa pra a sidebar, não é dado sensível de sistema.
settingsRouter.get('/branding', authenticate, asyncHandler(getBrandingHandler));

// Configurações técnicas (Firebird/SMTP/Geral) são dado sensível de sistema — só SYSTEM_SETTINGS.
settingsRouter.use(authenticate, requirePermission('SYSTEM_SETTINGS'));

settingsRouter.get('/firebird', asyncHandler(getFirebirdSettingsHandler));
settingsRouter.get('/firebird/password', asyncHandler(getFirebirdPasswordHandler));
settingsRouter.get('/firebird/status', asyncHandler(getFirebirdConnectionStatusHandler));
settingsRouter.put('/firebird', validate(firebirdSettingsSchema), asyncHandler(saveFirebirdSettingsHandler));
settingsRouter.post('/firebird/test', validate(firebirdSettingsSchema), asyncHandler(testFirebirdSettingsHandler));

settingsRouter.get('/smtp', asyncHandler(getSmtpSettingsHandler));
settingsRouter.get('/smtp/password', asyncHandler(getSmtpPasswordHandler));
settingsRouter.put('/smtp', validate(smtpSettingsSchema), asyncHandler(saveSmtpSettingsHandler));
settingsRouter.post('/smtp/test', validate(testEmailSchema), asyncHandler(testSmtpSettingsHandler));

settingsRouter.get('/geral', asyncHandler(getGeralSettingsHandler));
settingsRouter.put('/geral', validate(geralSettingsSchema), asyncHandler(saveGeralSettingsHandler));

settingsRouter.get('/integracoes', asyncHandler(getIntegracoesSettingsHandler));
settingsRouter.get('/integracoes/secret/:key', validate(integrationSecretParamSchema, 'params'), asyncHandler(getIntegrationSecretHandler));
settingsRouter.put('/integracoes', validate(integracoesSettingsSchema), asyncHandler(saveIntegracoesSettingsHandler));
