-- S6 (data-model refactor): lock the order lifecycle. A CHECK constraint pins the
-- allowed status set per kind, so no plugin can write a garbage (kind,status) tuple
-- (the original "lifecycle smeared, arbitrary tuples" finding). Added NOT VALID:
-- existing (legacy/messy) rows are NOT re-checked, but every INSERT/UPDATE from now
-- on must comply. Unknown kinds pass (ELSE true) so future plugin kinds aren't
-- blocked. Financial state is already derived (S1) — this constrains the
-- sales/operational lifecycle only. See docs/dogfood-sprint/DATA-MODEL-REFACTOR.md.
ALTER TABLE saas_core.orders DROP CONSTRAINT IF EXISTS orders_kind_status_valid;
ALTER TABLE saas_core.orders ADD CONSTRAINT orders_kind_status_valid CHECK (
  status IS NULL OR CASE kind
    WHEN 'quote'              THEN status IN ('draft','sent','approved','rejected','expired','converted')
    WHEN 'deal'               THEN status IN ('open','won','lost')
    WHEN 'appointment'        THEN status IN ('scheduled','confirmed','in_progress','completed','cancelled','no_show','invoiced','paid')
    WHEN 'service_order'      THEN status IN ('draft','scheduled','confirmed','in_progress','completed','cancelled','invoiced','paid')
    WHEN 'invoice_receivable' THEN status IN ('open','paid','partial','overdue','cancelled')
    WHEN 'invoice_payable'    THEN status IN ('open','paid','partial','overdue','cancelled')
    ELSE true
  END
) NOT VALID;
