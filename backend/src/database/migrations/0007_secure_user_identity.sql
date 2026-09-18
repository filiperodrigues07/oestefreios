ALTER TABLE "users" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "session_version" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "cherp_usuario_chave" integer;
--> statement-breakpoint
CREATE UNIQUE INDEX "users_cherp_usuario_chave_unique" ON "users" USING btree ("cherp_usuario_chave");
