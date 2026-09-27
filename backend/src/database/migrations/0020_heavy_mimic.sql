CREATE TABLE "client_notification_preferences" (
	"client_code" text PRIMARY KEY NOT NULL,
	"whatsapp_consent" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "os_message_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"os_id" text NOT NULL,
	"client_code" text NOT NULL,
	"channel" text NOT NULL,
	"message_type" text NOT NULL,
	"recipient" text NOT NULL,
	"body" text NOT NULL,
	"contains_financial" boolean DEFAULT false NOT NULL,
	"source" text NOT NULL,
	"state" text DEFAULT 'queued' NOT NULL,
	"event_key" text,
	"provider_message_id" text,
	"error_code" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "os_message_deliveries_event_key_unique" UNIQUE("event_key")
);
--> statement-breakpoint
ALTER TABLE "os_message_deliveries" ADD CONSTRAINT "os_message_deliveries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "os_message_deliveries_os_idx" ON "os_message_deliveries" USING btree ("os_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "os_message_deliveries_queue_idx" ON "os_message_deliveries" USING btree ("state","created_at");