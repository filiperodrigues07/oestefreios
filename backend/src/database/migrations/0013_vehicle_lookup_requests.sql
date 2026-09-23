CREATE TABLE "vehicle_lookup_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"provider" text NOT NULL,
	"plate" text NOT NULL,
	"status" text NOT NULL,
	"success" boolean NOT NULL,
	"consumed_quota" boolean NOT NULL,
	"result" jsonb,
	"cache_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "vehicle_lookup_quota_idx" ON "vehicle_lookup_requests" USING btree ("tenant_id", "created_at");
--> statement-breakpoint
CREATE INDEX "vehicle_lookup_cache_idx" ON "vehicle_lookup_requests" USING btree ("tenant_id", "plate", "cache_expires_at");
