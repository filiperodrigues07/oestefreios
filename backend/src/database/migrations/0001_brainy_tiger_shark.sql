ALTER TABLE "audit_logs" ADD COLUMN "user_name" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "entity_type" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "entity_id" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "changes" jsonb;