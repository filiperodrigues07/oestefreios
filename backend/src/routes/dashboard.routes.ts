import { Router } from 'express';
import { getAdminDashboardHandler, getOperationalDashboardHandler, getOperationalDashboardV2Handler, searchDashboardHandler } from '../controllers/dashboard.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middlewares/validate.js';
import { dashboardBuscaQuerySchema, dashboardOperacionalQuerySchema } from '../validators/dashboard.validator.js';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

/** "Minhas OS" — qualquer usuário autenticado vê as próprias, sem permissão extra. */
dashboardRouter.get('/me', asyncHandler(getOperationalDashboardHandler));

dashboardRouter.get('/admin', requirePermission('REPORT_VIEW'), asyncHandler(getAdminDashboardHandler));
dashboardRouter.get('/operacional', requirePermission('REPORT_VIEW'), validate(dashboardOperacionalQuerySchema, 'query'), asyncHandler(getOperationalDashboardV2Handler));
dashboardRouter.get('/busca', requirePermission('REPORT_VIEW'), validate(dashboardBuscaQuerySchema, 'query'), asyncHandler(searchDashboardHandler));
