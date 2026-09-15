import { apiFetch } from './httpClient.js';
import type { AdminDashboardDTO, OperationalDashboardDTO } from '../types/dashboard.types.js';

export function getAdminDashboard(): Promise<AdminDashboardDTO> {
  return apiFetch<AdminDashboardDTO>('/dashboard/admin');
}

export function getOperationalDashboard(): Promise<OperationalDashboardDTO> {
  return apiFetch<OperationalDashboardDTO>('/dashboard/me');
}
