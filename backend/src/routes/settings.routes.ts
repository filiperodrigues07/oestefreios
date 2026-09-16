import { Router } from 'express';
import {
  getBrandingHandler,
  getFirebirdSettingsHandler,
  getGeralSettingsHandler,
  getSmtpSettingsHandler,
  saveFirebirdSettingsHandler,
  saveGeralSettingsHandler,
  saveSmtpSettingsHandler,
  testFirebirdSettingsHandler,
  testSmtpSettingsHandler,
} from '../controllers/settings.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { firebirdSettingsSchema, geralSettingsSchema, smtpSettingsSchema, testEmailSchema } from '../validators/settings.validator.js';

export const settingsRouter = Router();

// Nome/logo do cliente: qualquer usuário logado precisa pra a sidebar, não é dado sensível de sistema.
settingsRouter.get('/branding', authenticate, asyncHandler(getBrandingHandler));

// Configurações técnicas (Firebird/SMTP/Geral) são dado sensível de sistema — só SYSTEM_SETTINGS.
settingsRouter.use(authenticate, requirePermission('SYSTEM_SETTINGS'));

settingsRouter.get('/firebird', asyncHandler(getFirebirdSettingsHandler));
settingsRouter.put('/firebird', validate(firebirdSettingsSchema), asyncHandler(saveFirebirdSettingsHandler));
settingsRouter.post('/firebird/test', validate(firebirdSettingsSchema), asyncHandler(testFirebirdSettingsHandler));

settingsRouter.get('/smtp', asyncHandler(getSmtpSettingsHandler));
settingsRouter.put('/smtp', validate(smtpSettingsSchema), asyncHandler(saveSmtpSettingsHandler));
settingsRouter.post('/smtp/test', validate(testEmailSchema), asyncHandler(testSmtpSettingsHandler));

settingsRouter.get('/geral', asyncHandler(getGeralSettingsHandler));
settingsRouter.put('/geral', validate(geralSettingsSchema), asyncHandler(saveGeralSettingsHandler));
