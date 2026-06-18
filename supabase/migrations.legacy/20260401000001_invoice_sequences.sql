-- ---------------------------------------------------------------------------
-- Sequential invoice numbering — atomic per-tenant counter
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS saas_core.sequences (
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id),
  kind text NOT NULL,
  current_value bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, kind)
);
ALTER TABLE saas_core.sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY sequences_tenant ON saas_core.sequences
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
-- Atomically increment and return the next value for a tenant+kind pair.
-- First call for a new pair initializes at 1.
CREATE OR REPLACE FUNCTION saas_core.next_sequence(p_tenant_id uuid, p_kind text)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE
  v_next bigint;
BEGIN
  INSERT INTO saas_core.sequences (tenant_id, kind, current_value)
  VALUES (p_tenant_id, p_kind, 1)
  ON CONFLICT (tenant_id, kind)
  DO UPDATE SET current_value = saas_core.sequences.current_value + 1
  RETURNING current_value INTO v_next;
  RETURN v_next;
END;
$$;
