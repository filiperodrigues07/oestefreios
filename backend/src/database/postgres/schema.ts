import { relations } from 'drizzle-orm';
import { boolean, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  description: text('description'),
  isSystem: boolean('is_system').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const permissions = pgTable('permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  description: text('description'),
});

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })],
);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  photoUrl: text('photo_url'),
  passwordHash: text('password_hash').notNull(),
  roleId: uuid('role_id')
    .notNull()
    .references(() => roles.id),
  isActive: boolean('is_active').notNull().default(true),
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  sessionVersion: integer('session_version').notNull().default(0),
  cherpUsuarioChave: integer('cherp_usuario_chave'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex('users_cherp_usuario_chave_unique').on(table.cherpUsuarioChave)]);

/**
 * Permissões efetivas por usuário — fonte de verdade a partir da Fase G (redesenho de
 * Usuários e Permissões). `role_permissions` continua existindo só como "preset": o que
 * marca automaticamente ao escolher um perfil no formulário. Um usuário pode ter permissões
 * que divergem do preset do seu papel (customização individual, com aviso na UI).
 */
export const userPermissions = pgTable(
  'user_permissions',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.permissionId] })],
);

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  familyId: uuid('family_id').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  replacedByTokenId: uuid('replaced_by_token_id'),
  createdByIp: text('created_by_ip'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  /** Nome do usuário no momento do evento — sobrevive mesmo se o usuário for depois removido/renomeado. */
  userName: text('user_name'),
  event: text('event').notNull(),
  /** Entidade afetada (ex. "OS", "USER"). Null pros eventos de auth (login/logout), que não têm uma entidade de negócio. */
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  /**
   * Diff estruturado { before, after } da ação, quando aplicável. Nunca grave senha/token aqui —
   * valores financeiros (preço/custo/faturamento) podem entrar, então o endpoint de leitura filtra
   * por FINANCIAL_VIEW igual a qualquer outro DTO da aplicação (auditLog.dto.ts).
   */
  changes: jsonb('changes'),
  ip: text('ip'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Metadados de workflow da OS que o CHERP não tem campo próprio para guardar
 * (status granular do nosso fluxo, prioridade, histórico de eventos, responsável/
 * técnico — nossos próprios usuários, sem correspondência no CHERP). A OS "de
 * verdade" (cliente, equipamento, itens, valores) mora no Firebird; esta tabela é
 * só o complemento, ligada por `id` = ORDEMSERVICO.IDENTIFICADOR (UUID gerado pelo
 * CHERP). Uma OS aberta direto no CHERP (sem passar pelo app) pode não ter linha
 * aqui ainda — o repositório Firebird trata isso com valores padrão na leitura e
 * materializa a linha na primeira atualização feita pelo app (ver OSRepository.firebird.ts).
 */
export const osWorkflow = pgTable('os_workflow', {
  id: uuid('id').primaryKey(),
  status: text('status').notNull(),
  prioridade: text('prioridade').notNull(),
  responsavelId: uuid('responsavel_id').references(() => users.id, { onDelete: 'set null' }),
  tecnicoId: uuid('tecnico_id').references(() => users.id, { onDelete: 'set null' }),
  dataPrevista: timestamp('data_prevista', { withTimezone: true }),
  /**
   * "Finalizar OS" travou a edição só pra esse app — nunca escreve nada de volta no CHERP (o time de
   * faturamento segue processando por lá). Único sinal de bloqueio que não depende de nenhum campo do
   * CHERP; ver `assertNaoFinalizada` em os.service.ts.
   */
  travadoLocal: boolean('travado_local').notNull().default(false),
  /** Array de { timestamp, evento, usuarioNome } — timeline exibida na tela de detalhe da OS. */
  historico: jsonb('historico').notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Configurações administráveis pela tela /configuracoes (SYSTEM_SETTINGS): uma linha por
 * categoria (`firebird`, `smtp`, `geral`), `data` livre em jsonb pra cada categoria ter seu
 * próprio formato sem precisar de migração a cada campo novo. `env.ts` continua sendo o
 * valor inicial/fallback (primeiro boot, antes de existir qualquer linha aqui) — ver
 * `services/settings.service.ts`. Senhas em `data` nunca voltam em texto puro pro frontend.
 */
export const settings = pgTable('settings', {
  category: text('category').primaryKey(),
  data: jsonb('data').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const rolesRelations = relations(roles, ({ many }) => ({
  rolePermissions: many(rolePermissions),
  users: many(users),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
  userPermissions: many(userPermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, { fields: [rolePermissions.roleId], references: [roles.id] }),
  permission: one(permissions, { fields: [rolePermissions.permissionId], references: [permissions.id] }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  role: one(roles, { fields: [users.roleId], references: [roles.id] }),
  refreshTokens: many(refreshTokens),
  userPermissions: many(userPermissions),
}));

export const userPermissionsRelations = relations(userPermissions, ({ one }) => ({
  user: one(users, { fields: [userPermissions.userId], references: [users.id] }),
  permission: one(permissions, { fields: [userPermissions.permissionId], references: [permissions.id] }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}));
