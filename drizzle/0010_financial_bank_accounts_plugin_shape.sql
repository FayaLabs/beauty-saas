ALTER TABLE "bank_accounts"
  ADD COLUMN IF NOT EXISTS "account_type" text,
  ADD COLUMN IF NOT EXISTS "account_number" text,
  ADD COLUMN IF NOT EXISTS "agency_number" text,
  ADD COLUMN IF NOT EXISTS "current_balance" numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "initial_balance" numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "credit_limit" numeric(14,2),
  ADD COLUMN IF NOT EXISTS "due_day" integer,
  ADD COLUMN IF NOT EXISTS "closing_day" integer,
  ADD COLUMN IF NOT EXISTS "unit_id" uuid;
--> statement-breakpoint
UPDATE "bank_accounts"
SET "account_type" = CASE
  WHEN "account_type" IS NOT NULL THEN "account_type"
  WHEN "type" = 'checking' THEN 'bank_account'
  WHEN "type" = 'savings' THEN 'bank_account'
  WHEN "type" = 'cash' THEN 'cash_register'
  WHEN "type" = 'credit_card' THEN 'credit_card'
  ELSE 'bank_account'
END;
--> statement-breakpoint
ALTER TABLE "bank_accounts"
  ALTER COLUMN "account_type" SET DEFAULT 'bank_account',
  ALTER COLUMN "account_type" SET NOT NULL,
  ALTER COLUMN "is_active" SET NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bank_accounts_tenant" ON "bank_accounts" ("tenant_id");
