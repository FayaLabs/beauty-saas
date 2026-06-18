import { pgTable, uuid, text, boolean, tenantId, timestamps } from '@fayz-ai/db'

// Standalone app table (no archetype match) — beauty bank accounts.
export const bankAccounts = pgTable('bank_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantId(),
  name: text('name').notNull(),
  type: text('type').default('checking'),
  bankName: text('bank_name'),
  isActive: boolean('is_active').default(true),
  ...timestamps,
})
