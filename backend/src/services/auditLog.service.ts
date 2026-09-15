import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../database/postgres/client.js';
import { auditLogs } from '../database/postgres/schema.js';
import type { AuditLogDTO } from '../dto/auditLog.dto.js';
import type { Permission } from '../types/auth.types.js';

const FINANCIAL_FIELDS = new Set(['precoUnitario', 'custo', 'valorUnitario', 'total', 'desconto', 'faturamento']);

/** Remove campos financeiros de um objeto de diff arbitrário — mesma regra de DTO do resto do app, aplicada à auditoria. */
function stripFinancial(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripFinancial);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !FINANCIAL_FIELDS.has(key))
        .map(([key, val]) => [key, stripFinancial(val)]),
    );
  }
  return value;
}

export interface RecordAuditInput {
  userId: string | null;
  userName?: string | null;
  event: string;
  entityType?: string;
  entityId?: string;
  /** Diff estruturado, tipicamente { before, after }. Nunca inclua senha/token aqui. */
  changes?: unknown;
  ip?: string;
  userAgent?: string;
}

export async function recordAudit(input: RecordAuditInput): Promise<void> {
  await db.insert(auditLogs).values({
    userId: input.userId,
    userName: input.userName ?? null,
    event: input.event,
    entityType: input.entityType,
    entityId: input.entityId,
    changes: input.changes ?? null,
    ip: input.ip,
    userAgent: input.userAgent,
  });
}

export interface AuditLogFilter {
  entityType?: string;
  event?: string;
  page?: number;
  limit?: number;
}

export async function listAuditLogs(
  filter: AuditLogFilter,
  permissions: Permission[],
): Promise<{ items: AuditLogDTO[]; page: number; limit: number; total: number }> {
  const page = filter.page ?? 1;
  const limit = Math.min(filter.limit ?? 20, 100);
  const offset = (page - 1) * limit;

  const conditions = [];
  if (filter.entityType) conditions.push(eq(auditLogs.entityType, filter.entityType));
  if (filter.event) conditions.push(eq(auditLogs.event, filter.event));

  const where = conditions.length > 0 ? conditions.reduce((a, b) => sql`${a} AND ${b}`) : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(auditLogs).where(where),
  ]);

  const podeVerFinanceiro = permissions.includes('FINANCIAL_VIEW');

  const items: AuditLogDTO[] = rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    userName: row.userName,
    event: row.event,
    entityType: row.entityType,
    entityId: row.entityId,
    changes: podeVerFinanceiro ? row.changes : stripFinancial(row.changes),
    ip: row.ip,
    createdAt: row.createdAt.toISOString(),
  }));

  return { items, page, limit, total: totalRows[0]?.count ?? 0 };
}
