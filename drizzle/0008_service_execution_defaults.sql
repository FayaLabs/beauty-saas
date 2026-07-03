CREATE TABLE IF NOT EXISTS "service_default_products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "service_id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "quantity" numeric(12,3) DEFAULT 1 NOT NULL,
  "unit" text,
  "deduction_timing" text DEFAULT 'on_execution' NOT NULL,
  "is_required" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "service_default_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "service_id" uuid NOT NULL,
  "template_id" uuid NOT NULL,
  "template_kind" text DEFAULT 'form' NOT NULL,
  "trigger" text DEFAULT 'before_execution' NOT NULL,
  "is_required" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_default_products" ADD CONSTRAINT "service_default_products_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_core"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_default_products" ADD CONSTRAINT "service_default_products_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "saas_core"."services"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_default_products" ADD CONSTRAINT "service_default_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "saas_core"."products"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_default_templates" ADD CONSTRAINT "service_default_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_core"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_default_templates" ADD CONSTRAINT "service_default_templates_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "saas_core"."services"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_default_templates" ADD CONSTRAINT "service_default_templates_template_id_frm_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."frm_templates"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_default_products_tenant_service_idx" ON "service_default_products" USING btree ("tenant_id","service_id","sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_default_products_product_idx" ON "service_default_products" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_default_templates_tenant_service_idx" ON "service_default_templates" USING btree ("tenant_id","service_id","sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_default_templates_template_idx" ON "service_default_templates" USING btree ("template_id");
