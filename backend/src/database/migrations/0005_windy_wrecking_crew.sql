CREATE TABLE "user_permissions" (
	"user_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	CONSTRAINT "user_permissions_user_id_permission_id_pk" PRIMARY KEY("user_id","permission_id")
);
--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Backfill: copia pra user_permissions as permissões que cada usuário já tinha por herança do
-- papel, pra "user_permissions" virar a fonte de verdade sem que ninguém perca acesso na migração.
INSERT INTO "user_permissions" ("user_id", "permission_id")
SELECT u."id", rp."permission_id"
FROM "users" u
JOIN "role_permissions" rp ON rp."role_id" = u."role_id"
ON CONFLICT ("user_id", "permission_id") DO NOTHING;