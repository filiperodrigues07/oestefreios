import { Router } from 'express';
import { z } from 'zod';
import { getLicenseHandler, listSessionsHandler, forceLogoutSessionHandler, forceLogoutAllHandler } from '../controllers/session.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const sessionRouter = Router();
sessionRouter.use(authenticate, requirePermission('SYSTEM_SETTINGS'));
sessionRouter.get('/', asyncHandler(listSessionsHandler));
sessionRouter.get('/license', asyncHandler(getLicenseHandler));
sessionRouter.delete('/:id', validate(z.object({ id: z.string().uuid() }), 'params'), asyncHandler(forceLogoutSessionHandler));

export const sessionUserRouter = Router();
sessionUserRouter.delete('/:userId/sessions', authenticate, requirePermission('SYSTEM_SETTINGS'),
  validate(z.object({ userId: z.string().uuid() }), 'params'), asyncHandler(forceLogoutAllHandler));
