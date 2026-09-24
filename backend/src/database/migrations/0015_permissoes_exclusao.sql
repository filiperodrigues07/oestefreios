-- Permissões de exclusão. O deploy roda só `migrate` (nunca o seed), então sem estas linhas o botão
-- Excluir some para todo mundo e a matriz de Usuários não consegue conceder. Idempotente: pode rodar de novo.
INSERT INTO "permissions" ("code", "description") VALUES
  ('OS_DELETE', 'Excluir OS'),
  ('CLIENT_DELETE', 'Excluir clientes'),
  ('VEHICLE_DELETE', 'Excluir veículos')
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."name" = 'Administrador'
  AND p."code" IN ('OS_DELETE', 'CLIENT_DELETE', 'VEHICLE_DELETE')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "user_permissions" ("user_id", "permission_id")
SELECT u."id", p."id"
FROM "users" u
JOIN "roles" r ON r."id" = u."role_id"
CROSS JOIN "permissions" p
WHERE r."name" = 'Administrador'
  AND p."code" IN ('OS_DELETE', 'CLIENT_DELETE', 'VEHICLE_DELETE')
ON CONFLICT DO NOTHING;
