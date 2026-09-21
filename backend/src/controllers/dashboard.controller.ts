import type { Request, Response } from 'express';
import * as dashboardService from '../services/dashboard.service.js';
import { success } from '../utils/apiResponse.js';

export async function getAdminDashboardHandler(req: Request, res: Response) {
  const dashboard = await dashboardService.getAdminDashboard(req.user!.permissions);
  success(res, dashboard);
}

export async function getOperationalDashboardV2Handler(req: Request, res: Response) {
  const { inicio, fim, granularidade } = req.query as unknown as {
    inicio: Date;
    fim: Date;
    granularidade: 'diario' | 'semanal' | 'mensal';
  };
  const dashboard = await dashboardService.getOperationalDashboardV2({ inicio, fim, granularidade });
  success(res, dashboard);
}

export async function searchDashboardHandler(req: Request, res: Response) {
  const { q } = req.query as unknown as { q: string };
  success(res, await dashboardService.searchDashboard(q, req.user!.permissions));
}

export async function getOperationalDashboardHandler(req: Request, res: Response) {
  const dashboard = await dashboardService.getOperationalDashboard(req.user!);
  success(res, dashboard);
}
