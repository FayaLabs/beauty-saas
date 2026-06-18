-- Fix: Add missing foreign key constraints for cross-schema joins
-- These FKs are needed for PostgREST to support embedded resource queries (joins)
-- Some tables were created by earlier migrations without these constraints

-- Helper: safely add FK if not exists
CREATE OR REPLACE FUNCTION public._add_fk_if_missing(
  p_table text, p_column text, p_ref_schema text, p_ref_table text, p_ref_column text, p_constraint text
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = p_constraint) THEN
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I.%I(%I) ON DELETE CASCADE',
      p_table, p_constraint, p_column, p_ref_schema, p_ref_table, p_ref_column);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FK % already exists or cannot be created: %', p_constraint, SQLERRM;
END;
$$;

-- ==========================================
-- INVENTORY PLUGIN FKs
-- ==========================================

-- stock_movements → saas_core.products
SELECT public._add_fk_if_missing('stock_movements', 'product_id', 'saas_core', 'products', 'id', 'fk_stock_movements_product');

-- stock_movements → saas_core.persons (supplier)
SELECT public._add_fk_if_missing('stock_movements', 'supplier_id', 'saas_core', 'persons', 'id', 'fk_stock_movements_supplier');

-- stock_movements → stock_locations
SELECT public._add_fk_if_missing('stock_movements', 'stock_location_id', 'public', 'stock_locations', 'id', 'fk_stock_movements_location');

-- stock_positions → saas_core.products
SELECT public._add_fk_if_missing('stock_positions', 'product_id', 'saas_core', 'products', 'id', 'fk_stock_positions_product');

-- recipes → saas_core.products
SELECT public._add_fk_if_missing('recipes', 'product_id', 'saas_core', 'products', 'id', 'fk_recipes_product');

-- recipe_ingredients → saas_core.products
SELECT public._add_fk_if_missing('recipe_ingredients', 'product_id', 'saas_core', 'products', 'id', 'fk_recipe_ingredients_product');

-- ==========================================
-- FINANCIAL PLUGIN FKs
-- ==========================================

-- financial_movements → saas_core.orders (invoice)
SELECT public._add_fk_if_missing('financial_movements', 'invoice_id', 'saas_core', 'orders', 'id', 'fk_financial_movements_invoice');

-- financial_movements → payment_methods
SELECT public._add_fk_if_missing('financial_movements', 'payment_method_id', 'public', 'payment_methods', 'id', 'fk_financial_movements_payment_method');

-- financial_movements → bank_accounts
SELECT public._add_fk_if_missing('financial_movements', 'bank_account_id', 'public', 'bank_accounts', 'id', 'fk_financial_movements_bank_account');

-- financial_movements → cash_register_sessions
SELECT public._add_fk_if_missing('financial_movements', 'cash_session_id', 'public', 'cash_register_sessions', 'id', 'fk_financial_movements_cash_session');

-- cash_register_sessions → bank_accounts
SELECT public._add_fk_if_missing('cash_register_sessions', 'bank_account_id', 'public', 'bank_accounts', 'id', 'fk_cash_sessions_bank_account');

-- payment_methods → payment_method_types
SELECT public._add_fk_if_missing('payment_methods', 'payment_method_type_id', 'public', 'payment_method_types', 'id', 'fk_payment_methods_type');

-- ==========================================
-- CRM PLUGIN FKs
-- ==========================================

-- deal_extensions → saas_core.orders
SELECT public._add_fk_if_missing('deal_extensions', 'order_id', 'saas_core', 'orders', 'id', 'fk_deal_extensions_order');

-- deal_extensions → saas_core.persons (lead)
SELECT public._add_fk_if_missing('deal_extensions', 'lead_id', 'saas_core', 'persons', 'id', 'fk_deal_extensions_lead');

-- deal_extensions → pipelines
SELECT public._add_fk_if_missing('deal_extensions', 'pipeline_id', 'public', 'pipelines', 'id', 'fk_deal_extensions_pipeline');

-- deal_extensions → pipeline_stages
SELECT public._add_fk_if_missing('deal_extensions', 'stage_id', 'public', 'pipeline_stages', 'id', 'fk_deal_extensions_stage');

-- pipeline_stages → pipelines
SELECT public._add_fk_if_missing('pipeline_stages', 'pipeline_id', 'public', 'pipelines', 'id', 'fk_pipeline_stages_pipeline');

-- crm_activities → saas_core.orders (deal)
SELECT public._add_fk_if_missing('crm_activities', 'deal_id', 'saas_core', 'orders', 'id', 'fk_crm_activities_deal');

-- crm_activities → saas_core.persons (lead)
SELECT public._add_fk_if_missing('crm_activities', 'lead_id', 'saas_core', 'persons', 'id', 'fk_crm_activities_lead');

-- crm_activities → saas_core.persons (contact)
SELECT public._add_fk_if_missing('crm_activities', 'contact_id', 'saas_core', 'persons', 'id', 'fk_crm_activities_contact');

-- Cleanup helper
DROP FUNCTION IF EXISTS public._add_fk_if_missing;

-- Reload PostgREST schema cache to pick up new FKs
NOTIFY pgrst, 'reload schema';
