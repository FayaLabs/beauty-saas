// GERADO por scripts/functions-sync.mjs — NÃO EDITE AQUI.
// Fonte: plugin-agenda → src/integrations/google-calendar/data/tables.ts
// Edite no repo do plugin e rode: npm run functions:sync
// Canonical DB object names for the Google Calendar connector.
//
// Plugin-owned tables carry the platform `plg_<plugin>_` prefix (DATA-MODEL.md
// Ring 1). Single source of truth so the connector data layer (supabase.ts) and
// the google-calendar-sync edge function never drift on a table name. The SQL
// side is owned by ./migrations/001_google_calendar.sql + 002_smart_sync.sql
// (fresh installs) and 003_plg_rename.sql (legacy-pool rename).
export const GCAL_TABLES = {
  integrations: 'plg_calendar_integrations',
  channels: 'plg_calendar_channels',
  syncLog: 'plg_calendar_sync_log',
} as const
