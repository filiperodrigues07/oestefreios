-- Reabrir OS finalizada/cancelada pelo app. O deploy roda só `migrate` (nunca o seed): sem estas linhas a
-- permissão não existe em produção. Vai pro preset de Administrador e Gerente e pros usuários que já têm
-- esses perfis. Idempotente: pode rodar de novo.
INSERT INTO "permissions" ("code", "description") VALUES
  ('OS_REOPEN', 'Reabrir OS finalizada ou cancelada')
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."name" IN ('Administrador', 'Gerente')
  AND p."code" = 'OS_REOPEN'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "user_permissions" ("user_id", "permission_id")
SELECT u."id", p."id"
FROM "users" u
JOIN "roles" r ON r."id" = u."role_id"
CROSS JOIN "permissions" p
WHERE r."name" IN ('Administrador', 'Gerente')
  AND p."code" = 'OS_REOPEN'
ON CONFLICT DO NOTHING;
