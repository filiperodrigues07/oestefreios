CREATE TABLE "os_workflow" (
	"id" uuid PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"prioridade" text NOT NULL,
	"responsavel_id" uuid,
	"tecnico_id" uuid,
	"data_prevista" timestamp with time zone,
	"historico" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "os_workflow" ADD CONSTRAINT "os_workflow_responsavel_id_users_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "os_workflow" ADD CONSTRAINT "os_workflow_tecnico_id_users_id_fk" FOREIGN KEY ("tecnico_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;