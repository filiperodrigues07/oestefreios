ALTER TABLE "users" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "users_last_seen_at_idx" ON "users" USING btree ("last_seen_at");
