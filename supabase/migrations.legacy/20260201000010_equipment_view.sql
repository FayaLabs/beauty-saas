-- Equipment view — filters products by metadata->>'productType' = 'asset'
CREATE OR REPLACE VIEW public.equipment_view AS
SELECT * FROM saas_core.products
WHERE metadata->>'productType' = 'asset';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment_view TO authenticated;

-- Also add a proper product_type column to products for easier filtering
-- This is a better long-term solution than relying on metadata JSONB
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'saas_core' AND table_name = 'products' AND column_name = 'kind') THEN
    ALTER TABLE saas_core.products ADD COLUMN kind text;
  END IF;
END $$;

-- Backfill kind from metadata for existing products
UPDATE saas_core.products SET kind = metadata->>'productType' WHERE kind IS NULL AND metadata->>'productType' IS NOT NULL;

NOTIFY pgrst, 'reload schema';
