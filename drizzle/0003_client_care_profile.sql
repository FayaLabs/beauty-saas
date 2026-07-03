ALTER TABLE "clients" ADD COLUMN "lifecycle_status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "stage" text DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "anamnesis_notes" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "status_alert" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "has_anamnesis_alert" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "preferences" jsonb DEFAULT '{}'::jsonb NOT NULL;
