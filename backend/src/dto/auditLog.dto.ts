export interface AuditLogDTO {
  id: string;
  userId: string | null;
  userName: string | null;
  event: string;
  entityType: string | null;
  entityId: string | null;
  /** Campos financeiros já removidos pelo service quando o perfil não tem FINANCIAL_VIEW. */
  changes: unknown;
  ip: string | null;
  createdAt: string;
}
