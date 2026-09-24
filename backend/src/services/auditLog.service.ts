import { and, desc, eq, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm';
import { db } from '../database/postgres/client.js';
import { auditLogs } from '../database/postgres/schema.js';
import type { AuditLogDTO } from '../dto/auditLog.dto.js';
import type { Permission } from '../types/auth.types.js';
import type { RelatorioResultado } from '../dto/relatorio.dto.js';

const FINANCIAL_FIELDS = new Set(['precoUnitario', 'custo', 'valorUnitario', 'total', 'desconto', 'faturamento']);
const EVENT_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: 'Login bem-sucedido', LOGIN_FAILURE: 'Tentativa de login falhou', LOGOUT: 'Logout',
  TOKEN_REUSE_DETECTED: 'Reuso de token detectado', PASSWORD_RESET_REQUESTED: 'Redefinição de senha solicitada',
  PASSWORD_RESET_COMPLETED: 'Senha redefinida', PASSWORD_CHANGED: 'Senha alterada',
  PROFILE_UPDATED: 'Perfil atualizado', PROFILE_PHOTO_UPDATED: 'Foto de perfil atualizada',
  OS_CREATED: 'OS criada', OS_UPDATED: 'OS atualizada', OS_STATUS_CHANGED: 'Status da OS alterado',
  OS_DELETED: 'OS excluída', OS_DUPLICATED: 'OS duplicada',
  OS_PRODUCT_ADDED: 'Produto adicionado à OS', OS_PRODUCT_REMOVED: 'Produto removido da OS',
  OS_PRODUCT_UPDATED: 'Produto atualizado na OS', OS_SERVICE_ADDED: 'Serviço adicionado à OS',
  OS_SERVICE_REMOVED: 'Serviço removido da OS', OS_SERVICE_UPDATED: 'Serviço atualizado na OS',
  OS_IMAGE_ADDED: 'Imagem adicionada à OS', OS_IMAGE_REMOVED: 'Imagem removida da OS',
  USER_CREATED: 'Usuário criado', USER_UPDATED: 'Usuário atualizado', USER_DELETED: 'Usuário excluído',
  USER_INVITE_RESENT: 'Convite reenviado', CLIENTE_CREATED: 'Cliente criado', CLIENTE_UPDATED: 'Cliente atualizado',
  VEICULO_CREATED: 'Veículo criado', VEICULO_UPDATED: 'Veículo atualizado',
  SETTINGS_FIREBIRD_UPDATED: 'Firebird atualizado', SETTINGS_SMTP_UPDATED: 'E-mail atualizado',
  SETTINGS_GERAL_UPDATED: 'Configurações gerais atualizadas',
  CLIENTE_DELETED: 'Cliente excluído', VEICULO_DELETED: 'Veículo excluído',
  BILLING_UPDATED: 'Dados da assinatura atualizados', BILLING_PAYMENT_ADDED: 'Pagamento da mensalidade registrado', BILLING_PAYMENT_REMOVED: 'Pagamento da mensalidade removido',
  SESSION_REPLACED: 'Sessão anterior derrubada por novo login', SESSION_FORCE_LOGOUT: 'Sessão encerrada', SESSION_FORCE_LOGOUT_ALL: 'Todas as sessões encerradas',
};

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
  categoria?: string;
  dataInicial?: Date;
  dataFinal?: Date;
  userId?: string;
  usuario?: string;
  busca?: string;
  page?: number;
  limit?: number;
}

function auditWhere(filter: AuditLogFilter) {
  const conditions = [];
  if (filter.entityType) conditions.push(eq(auditLogs.entityType, filter.entityType));
  if (filter.event) conditions.push(eq(auditLogs.event, filter.event));
  if (filter.categoria === 'AUTH') conditions.push(inArray(auditLogs.event, ['LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT', 'TOKEN_REUSE_DETECTED', 'PASSWORD_CHANGED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED', 'PROFILE_UPDATED', 'PROFILE_PHOTO_UPDATED']));
  else if (filter.categoria) conditions.push(ilike(auditLogs.event, `${filter.categoria.replace(/[\\%_]/g, '\\$&')}%`));
  if (filter.userId) conditions.push(eq(auditLogs.userId, filter.userId));
  if (filter.usuario) conditions.push(ilike(auditLogs.userName, `%${filter.usuario.replace(/[\\%_]/g, '\\$&')}%`));
  if (filter.dataInicial) conditions.push(gte(auditLogs.createdAt, filter.dataInicial));
  if (filter.dataFinal) conditions.push(lte(auditLogs.createdAt, filter.dataFinal));
  if (filter.busca) {
    const term = `%${filter.busca.replace(/[\\%_]/g, '\\$&')}%`;
    conditions.push(or(ilike(auditLogs.userName, term), ilike(auditLogs.event, term), ilike(auditLogs.entityId, term))!);
  }
  return conditions.length ? and(...conditions) : undefined;
}

export async function listAuditLogs(
  filter: AuditLogFilter,
  permissions: Permission[],
): Promise<{ items: AuditLogDTO[]; page: number; limit: number; total: number }> {
  const page = filter.page ?? 1;
  const limit = Math.min(filter.limit ?? 20, 100);
  const offset = (page - 1) * limit;

  const where = auditWhere(filter);

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
    userAgent: row.userAgent,
    createdAt: row.createdAt.toISOString(),
  }));

  return { items, page, limit, total: totalRows[0]?.count ?? 0 };
}

export async function exportAuditLogs(filter: AuditLogFilter): Promise<RelatorioResultado> {
  const rows = await db.select().from(auditLogs).where(auditWhere(filter)).orderBy(desc(auditLogs.createdAt)).limit(5000);
  return {
    titulo: 'Auditoria', geradoEm: new Date().toISOString(),
    colunas: [
      { key: 'data', label: 'Data/hora' }, { key: 'usuario', label: 'Usuário' },
      { key: 'evento', label: 'Evento' }, { key: 'entidade', label: 'Entidade' },
      { key: 'id', label: 'ID' }, { key: 'ip', label: 'IP' }, { key: 'dispositivo', label: 'User-agent' },
    ],
    linhas: rows.map(row => ({
      data: row.createdAt.toISOString(), usuario: row.userName ?? 'Sistema', evento: EVENT_LABELS[row.event] ?? row.event,
      entidade: row.entityType ?? '', id: row.entityId ?? '', ip: row.ip ?? '', dispositivo: row.userAgent ?? '',
    })),
  };
}
