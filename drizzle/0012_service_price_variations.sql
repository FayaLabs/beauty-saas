CREATE TABLE IF NOT EXISTS "service_price_variations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "variation_type" text DEFAULT 'discount' NOT NULL,
  "value_type" text DEFAULT 'percentage' NOT NULL,
  "value" numeric(12,2) DEFAULT 0 NOT NULL,
  "first_appointment_only" boolean DEFAULT false NOT NULL,
  "category_filter_type" text DEFAULT 'all' NOT NULL,
  "category_id" uuid,
  "professional_filter_type" text DEFAULT 'all' NOT NULL,
  "professional_id" uuid,
  "partnership_filter_type" text DEFAULT 'all' NOT NULL,
  "partnership_id" uuid,
  "unit_filter_type" text DEFAULT 'all' NOT NULL,
  "unit_id" uuid,
  "service_filter_type" text DEFAULT 'all' NOT NULL,
  "service_id" uuid,
  "is_active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_price_variations" ADD CONSTRAINT "service_price_variations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_core"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_price_variations" ADD CONSTRAINT "service_price_variations_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "saas_core"."categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_price_variations" ADD CONSTRAINT "service_price_variations_professional_id_persons_id_fk" FOREIGN KEY ("professional_id") REFERENCES "saas_core"."persons"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_price_variations" ADD CONSTRAINT "service_price_variations_partnership_id_persons_id_fk" FOREIGN KEY ("partnership_id") REFERENCES "saas_core"."persons"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_price_variations" ADD CONSTRAINT "service_price_variations_unit_id_locations_id_fk" FOREIGN KEY ("unit_id") REFERENCES "saas_core"."locations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_price_variations" ADD CONSTRAINT "service_price_variations_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "saas_core"."services"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_price_variations_tenant_active_idx" ON "service_price_variations" USING btree ("tenant_id","is_active","sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_price_variations_service_idx" ON "service_price_variations" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_price_variations_professional_idx" ON "service_price_variations" USING btree ("professional_id");
