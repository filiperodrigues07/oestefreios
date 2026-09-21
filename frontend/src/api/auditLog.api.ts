import { apiFetch, apiFetchBlob, salvarBlobComoArquivo } from './httpClient.js';
import type { AuditLogDTO } from '../types/auditLog.types.js';

interface PaginatedAuditLogs {
  items: AuditLogDTO[];
  page: number;
  limit: number;
  total: number;
}

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  entityType?: string;
  event?: string;
  categoria?: string;
  userId?: string;
  usuario?: string;
  dataInicial?: string;
  dataFinal?: string;
  busca?: string;
}

function query(filtros: AuditLogFilters, formato?: 'excel') {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filtros)) {
    if (value === undefined || value === '') continue;
    if (key === 'dataInicial' && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
      params.set(key, new Date(`${value}T00:00:00`).toISOString());
    } else if (key === 'dataFinal' && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
      params.set(key, new Date(`${value}T23:59:59.999`).toISOString());
    } else params.set(key, String(value));
  }
  if (formato) params.set('formato', formato);
  return `/audit-logs?${params}`;
}

export function listarAuditLogs(filtros: AuditLogFilters = {}): Promise<PaginatedAuditLogs> {
  return apiFetch<PaginatedAuditLogs>(query(filtros));
}

export async function exportarAuditLogs(filtros: AuditLogFilters): Promise<void> {
  const blob = await apiFetchBlob(query(filtros, 'excel'));
  salvarBlobComoArquivo(blob, 'auditoria.xlsx');
}
