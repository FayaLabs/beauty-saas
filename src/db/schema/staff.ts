import { pgTable, uuid, text, numeric, tenantId, timestamps } from '@fayz-ai/saas/db'

// Core-v1: persons -> public.people (thin FK-target ref).
const people = pgTable('people', { id: uuid('id').primaryKey() })

// Ring-2 archetype extension: beauty staff (person kind=staff).
// commission_rate was added later this sprint (staff_commission_rate migration).
export const staffMembers = pgTable('staff_members', {
  personId: uuid('person_id').primaryKey().references(() => people.id, { onDelete: 'cascade' }),
  tenantId: tenantId(),
  profession: text('profession'),
  commissionRate: numeric('commission_rate'),
  ...timestamps,
})
