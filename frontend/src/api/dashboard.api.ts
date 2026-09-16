import { apiFetch } from './httpClient.js';
import type { AdminDashboardDTO, DashboardGranularidade, DashboardOperacionalDTO, OperationalDashboardDTO } from '../types/dashboard.types.js';

export function getAdminDashboard(): Promise<AdminDashboardDTO> {
  return apiFetch<AdminDashboardDTO>('/dashboard/admin');
}

export function getOperationalDashboard(): Promise<OperationalDashboardDTO> {
  return apiFetch<OperationalDashboardDTO>('/dashboard/me');
}

export function getDashboardOperacional(input: { inicio: Date; fim: Date; granularidade: DashboardGranularidade }): Promise<DashboardOperacionalDTO> {
  const params = new URLSearchParams({
    inicio: input.inicio.toISOString(),
    fim: input.fim.toISOString(),
    granularidade: input.granularidade,
  });
  return apiFetch<DashboardOperacionalDTO>(`/dashboard/operacional?${params.toString()}`);
}

export interface DashboardSearchResult {
  tipo: 'OS' | 'CLIENTE';
  id: string;
  titulo: string;
  descricao: string;
}

export function searchDashboard(query: string): Promise<DashboardSearchResult[]> {
  return apiFetch<DashboardSearchResult[]>(`/dashboard/busca?q=${encodeURIComponent(query)}`);
}
