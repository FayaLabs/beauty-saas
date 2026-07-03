DO $$ BEGIN
 ALTER TABLE "appointment_schedule_rules" ADD CONSTRAINT "appointment_schedule_rules_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "saas_core"."locations"("id") ON DELETE set null ON UPDATE no action NOT VALID;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointment_waitlist_entries" ADD CONSTRAINT "appointment_waitlist_entries_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "saas_core"."services"("id") ON DELETE set null ON UPDATE no action NOT VALID;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointment_waitlist_entries" ADD CONSTRAINT "appointment_waitlist_entries_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "saas_core"."locations"("id") ON DELETE set null ON UPDATE no action NOT VALID;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointment_schedule_rules_location_idx" ON "appointment_schedule_rules" USING btree ("location_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointment_waitlist_entries_service_idx" ON "appointment_waitlist_entries" USING btree ("service_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointment_waitlist_entries_location_idx" ON "appointment_waitlist_entries" USING btree ("location_id");
--> statement-breakpoint
NOTIFY pgrst, 'reload schema';
