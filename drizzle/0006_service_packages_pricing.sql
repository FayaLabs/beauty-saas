CREATE TABLE IF NOT EXISTS "service_packages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "price" numeric(12,2) DEFAULT 0 NOT NULL,
  "validity_days" integer,
  "max_uses" integer,
  "is_active" boolean DEFAULT true NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "service_package_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "package_id" uuid NOT NULL,
  "service_id" uuid NOT NULL,
  "included_quantity" integer DEFAULT 1 NOT NULL,
  "unit_price" numeric(12,2),
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "service_price_tables" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "starts_on" date,
  "ends_on" date,
  "is_default" boolean DEFAULT false NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "service_price_table_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "price_table_id" uuid NOT NULL,
  "service_id" uuid NOT NULL,
  "price" numeric(12,2) DEFAULT 0 NOT NULL,
  "duration_minutes" integer,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_core"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_package_items" ADD CONSTRAINT "service_package_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_core"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_package_items" ADD CONSTRAINT "service_package_items_package_id_service_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."service_packages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_package_items" ADD CONSTRAINT "service_package_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "saas_core"."services"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_price_tables" ADD CONSTRAINT "service_price_tables_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_core"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_price_table_items" ADD CONSTRAINT "service_price_table_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_core"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_price_table_items" ADD CONSTRAINT "service_price_table_items_price_table_id_service_price_tables_id_fk" FOREIGN KEY ("price_table_id") REFERENCES "public"."service_price_tables"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_price_table_items" ADD CONSTRAINT "service_price_table_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "saas_core"."services"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_packages_tenant_active_idx" ON "service_packages" USING btree ("tenant_id","is_active","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_package_items_tenant_package_idx" ON "service_package_items" USING btree ("tenant_id","package_id","sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_package_items_service_idx" ON "service_package_items" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_price_tables_tenant_active_idx" ON "service_price_tables" USING btree ("tenant_id","is_active","sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_price_table_items_tenant_table_idx" ON "service_price_table_items" USING btree ("tenant_id","price_table_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_price_table_items_service_idx" ON "service_price_table_items" USING btree ("service_id");
