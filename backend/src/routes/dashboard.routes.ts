import { Router } from 'express';
import { getAdminDashboardHandler, getOperationalDashboardHandler } from '../controllers/dashboard.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

/** "Minhas OS" — qualquer usuário autenticado vê as próprias, sem permissão extra. */
dashboardRouter.get('/me', asyncHandler(getOperationalDashboardHandler));

dashboardRouter.get('/admin', requirePermission('REPORT_VIEW'), asyncHandler(getAdminDashboardHandler));
