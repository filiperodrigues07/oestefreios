-- OS_SEND: enviar a OS ao cliente por WhatsApp/e-mail (e revogar a autorização de WhatsApp). Antes isso vinha
-- junto de OS_CHANGE_STATUS; separar permite, por exemplo, o estoque só imprimir. Para não mudar o que cada
-- pessoa já fazia, nasce ligada pra quem hoje tem OS_CHANGE_STATUS (preset do perfil e usuários individuais).
-- Idempotente: pode rodar de novo.
INSERT INTO "permissions" ("code", "description") VALUES
  ('OS_SEND', 'Enviar a OS ao cliente por WhatsApp ou e-mail')
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT rp."role_id", novo."id"
FROM "role_permissions" rp
JOIN "permissions" antigo ON antigo."id" = rp."permission_id" AND antigo."code" = 'OS_CHANGE_STATUS'
CROSS JOIN "permissions" novo
WHERE novo."code" = 'OS_SEND'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "user_permissions" ("user_id", "permission_id")
SELECT up."user_id", novo."id"
FROM "user_permissions" up
JOIN "permissions" antigo ON antigo."id" = up."permission_id" AND antigo."code" = 'OS_CHANGE_STATUS'
CROSS JOIN "permissions" novo
WHERE novo."code" = 'OS_SEND'
ON CONFLICT DO NOTHING;
