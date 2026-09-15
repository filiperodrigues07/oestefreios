import { apiFetch } from './httpClient.js';
import type { AuditLogDTO } from '../types/auditLog.types.js';

interface PaginatedAuditLogs {
  items: AuditLogDTO[];
  page: number;
  limit: number;
  total: number;
}

export function listarAuditLogs(page = 1, limit = 20): Promise<PaginatedAuditLogs> {
  return apiFetch<PaginatedAuditLogs>(`/audit-logs?page=${page}&limit=${limit}`);
}
