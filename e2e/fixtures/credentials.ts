// QA tenant credentials (tenant slug `qa-fayz`, salon pool). The password lives
// in the app's .env as QA_TENANT_PASSWORD and is loaded by playwright.config.ts
// before any spec runs — it is NEVER hardcoded here.
export const QA_PASSWORD = process.env.QA_TENANT_PASSWORD ?? ''

export const OWNER_EMAIL = process.env.QA_OWNER_EMAIL ?? 'qa+beauty@fayalabs.com'
export const RESTRITO_EMAIL = process.env.QA_RESTRITO_EMAIL ?? 'qa-restrito+beauty@fayalabs.com'

// Seeded QA-tenant domain data (from supabase/qa-tenant.sql).
export const SEED = {
  clients: ['QA Cliente Um', 'QA Cliente Dois'],
  services: ['QA Corte Feminino', 'QA Manicure'],
  professionals: ['QA Cabeleireira Marina', 'QA Barbeiro Carlos'],
}
