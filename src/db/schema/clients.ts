import { boolean, date, integer, jsonb, numeric, pgTable, text, tenantId, timestamps, uuid } from '@fayz-ai/saas/db'

// Core-v1: persons -> public.people (thin FK-target ref).
const people = pgTable('people', { id: uuid('id').primaryKey() })

// Ring-2 archetype extension: beauty clients (person kind=client).
// Mirrors the live table; this Drizzle definition is the migration baseline.
export const clients = pgTable('clients', {
  personId: uuid('person_id').primaryKey().references(() => people.id, { onDelete: 'cascade' }),
  tenantId: tenantId(),
  gender: text('gender'),
  origin: text('origin'),
  lifecycleStatus: text('lifecycle_status').notNull().default('active'),
  stage: text('stage').notNull().default('new'),
  anamnesisNotes: text('anamnesis_notes'),
  statusAlert: text('status_alert'),
  hasAnamnesisAlert: boolean('has_anamnesis_alert').notNull().default(false),
  preferences: jsonb('preferences').$type<Record<string, unknown>>().notNull().default({}),
  visits: integer('visits').default(0),
  totalSpent: numeric('total_spent').default('0'),
  lastVisit: date('last_visit'),
  ...timestamps,
})
