-- Proprietário do sistema (super admin): flag fora da matriz de permissões, concedida só por script/seed.
-- Backfill: quem hoje é Administrador vira super admin (na VPS é só o dono; conferido por SELECT antes do deploy).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_super_admin" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "users" SET "is_super_admin" = true
WHERE "role_id" IN (SELECT "id" FROM "roles" WHERE "name" = 'Administrador');
