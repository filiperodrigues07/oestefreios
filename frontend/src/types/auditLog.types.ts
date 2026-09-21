export interface AuditLogDTO {
  id: string;
  userId: string | null;
  userName: string | null;
  event: string;
  entityType: string | null;
  entityId: string | null;
  changes: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}
