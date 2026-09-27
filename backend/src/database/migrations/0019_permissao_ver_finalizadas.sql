-- Quem não tem OS_VIEW_FINALIZADAS deixa de ver nas listas (consulta de OS, busca global, "Minhas OS") as OS
-- finalizadas/canceladas pelo app. Nasce ligada pra Administrador, Gerente e Atendente (preset e usuários que já
-- têm esses perfis); Mecânico e Supervisor ficam sem — dá pra ajustar usuário por usuário na tela de Usuários.
-- Idempotente: pode rodar de novo.
INSERT INTO "permissions" ("code", "description") VALUES
  ('OS_VIEW_FINALIZADAS', 'Ver OS finalizadas no app nas listas')
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."name" IN ('Administrador', 'Gerente', 'Atendente')
  AND p."code" = 'OS_VIEW_FINALIZADAS'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "user_permissions" ("user_id", "permission_id")
SELECT u."id", p."id"
FROM "users" u
JOIN "roles" r ON r."id" = u."role_id"
CROSS JOIN "permissions" p
WHERE r."name" IN ('Administrador', 'Gerente', 'Atendente')
  AND p."code" = 'OS_VIEW_FINALIZADAS'
ON CONFLICT DO NOTHING;
