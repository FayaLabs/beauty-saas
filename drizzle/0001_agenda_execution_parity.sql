CREATE TABLE IF NOT EXISTS "appointment_cancellation_reasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"requires_notes" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "appointment_waitlist_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid,
	"professional_id" uuid,
	"service_id" uuid,
	"location_id" uuid,
	"requested_date" timestamp with time zone,
	"preferred_start_time" text,
	"preferred_end_time" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"notes" text,
	"converted_booking_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "appointment_confirmation_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"channel" text NOT NULL,
	"template" text,
	"send_offset_hours" integer DEFAULT 24 NOT NULL,
	"retry_offset_hours" integer,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "appointment_schedule_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"scope" text DEFAULT 'tenant' NOT NULL,
	"location_id" uuid,
	"professional_id" uuid,
	"start_time" text DEFAULT '08:00' NOT NULL,
	"end_time" text DEFAULT '20:00' NOT NULL,
	"slot_duration_minutes" integer DEFAULT 30 NOT NULL,
	"buffer_minutes" integer DEFAULT 15 NOT NULL,
	"min_advance_hours" integer DEFAULT 2 NOT NULL,
	"max_advance_days" integer DEFAULT 30 NOT NULL,
	"max_concurrent" integer DEFAULT 1 NOT NULL,
	"allow_online_booking" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "cancellation_reason_id" uuid;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "cancellation_notes" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "confirmation_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "confirmation_channel" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "confirmation_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "execution_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "execution_checklist" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "stock_deduction_status" text DEFAULT 'not_required' NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointment_cancellation_reasons" ADD CONSTRAINT "appointment_cancellation_reasons_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_core"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointment_waitlist_entries" ADD CONSTRAINT "appointment_waitlist_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_core"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointment_confirmation_channels" ADD CONSTRAINT "appointment_confirmation_channels_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_core"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointment_schedule_rules" ADD CONSTRAINT "appointment_schedule_rules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_core"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointment_schedule_rules" ADD CONSTRAINT "appointment_schedule_rules_professional_id_persons_id_fk" FOREIGN KEY ("professional_id") REFERENCES "saas_core"."persons"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointment_waitlist_entries" ADD CONSTRAINT "appointment_waitlist_entries_client_id_persons_id_fk" FOREIGN KEY ("client_id") REFERENCES "saas_core"."persons"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointment_waitlist_entries" ADD CONSTRAINT "appointment_waitlist_entries_professional_id_persons_id_fk" FOREIGN KEY ("professional_id") REFERENCES "saas_core"."persons"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointment_waitlist_entries" ADD CONSTRAINT "appointment_waitlist_entries_converted_booking_id_bookings_id_fk" FOREIGN KEY ("converted_booking_id") REFERENCES "saas_core"."bookings"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointment_cancellation_reasons_tenant_active_idx" ON "appointment_cancellation_reasons" USING btree ("tenant_id","is_active","sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointment_confirmation_channels_tenant_active_idx" ON "appointment_confirmation_channels" USING btree ("tenant_id","is_active","sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointment_schedule_rules_tenant_scope_idx" ON "appointment_schedule_rules" USING btree ("tenant_id","scope","is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointment_schedule_rules_professional_idx" ON "appointment_schedule_rules" USING btree ("professional_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointment_waitlist_entries_tenant_status_idx" ON "appointment_waitlist_entries" USING btree ("tenant_id","status","requested_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointment_waitlist_entries_client_idx" ON "appointment_waitlist_entries" USING btree ("client_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointments" ADD CONSTRAINT "appointments_cancellation_reason_id_appointment_cancellation_reasons_id_fk" FOREIGN KEY ("cancellation_reason_id") REFERENCES "public"."appointment_cancellation_reasons"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
