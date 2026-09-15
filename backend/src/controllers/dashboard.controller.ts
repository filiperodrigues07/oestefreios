import type { Request, Response } from 'express';
import * as dashboardService from '../services/dashboard.service.js';
import { success } from '../utils/apiResponse.js';

export async function getAdminDashboardHandler(req: Request, res: Response) {
  const dashboard = await dashboardService.getAdminDashboard(req.user!.permissions);
  success(res, dashboard);
}

export async function getOperationalDashboardHandler(req: Request, res: Response) {
  const dashboard = await dashboardService.getOperationalDashboard(req.user!);
  success(res, dashboard);
}
