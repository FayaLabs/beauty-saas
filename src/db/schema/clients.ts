import { pgTable, uuid, text, integer, numeric, date, tenantId, timestamps, persons } from '@fayz-ai/db'

// Ring-2 archetype extension: beauty clients (person kind=client).
// Mirrors the live table; this Drizzle definition is the migration baseline.
export const clients = pgTable('clients', {
  personId: uuid('person_id').primaryKey().references(() => persons.id, { onDelete: 'cascade' }),
  tenantId: tenantId(),
  gender: text('gender'),
  origin: text('origin'),
  visits: integer('visits').default(0),
  totalSpent: numeric('total_spent').default('0'),
  lastVisit: date('last_visit'),
  ...timestamps,
})
