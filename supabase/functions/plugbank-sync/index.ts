// plugbank-sync — Tecnospeed PlugBank open-banking statement sync (data plane).
//
// Holds the bank-API credentials server-side and does the real work: validate
// the connection, fetch the statement for a date range, and import selected
// lines into public.plg_financial_movements (tagged external_source='plugbank',
// idempotent via the uq_plg_financial_movements_external index). The browser only
// invokes these actions; it never sees the bank API directly.
//
// Actions: test_connection | fetch_statement | import_transactions.
// Modeled on the predecessor app's inter-integration / pagbank-integration.
//
// This file is only the Deno wiring. The request handling lives in handler.js
// with every effect injected, so it is covered by `npm run test:functions`.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { handleRequest } from './handler.js'

Deno.serve((req: Request) =>
  handleRequest(req, {
    createClient,
    env: (name: string) => Deno.env.get(name),
  }),
)
