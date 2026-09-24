import { Router } from 'express';
import { getLicencaConfigHandler, saveLicencaConfigHandler } from '../controllers/superadmin.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireSuperAdmin } from '../middlewares/requireSuperAdmin.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { licencaConfigSchema } from '../validators/billing.validator.js';

/** Área do proprietário: tudo aqui devolve 404 para quem não é super admin. */
export const superAdminRouter = Router();
superAdminRouter.use(authenticate, requireSuperAdmin);
superAdminRouter.get('/licenca', asyncHandler(getLicencaConfigHandler));
superAdminRouter.put('/licenca', validate(licencaConfigSchema), asyncHandler(saveLicencaConfigHandler));
