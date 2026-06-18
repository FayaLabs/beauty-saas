import { pgTable, uuid, tenantId, timestamps, bookings } from '@fayz-ai/db'

// Ring-2 archetype extension: beauty appointments (booking archetype).
export const appointments = pgTable('appointments', {
  bookingId: uuid('booking_id').primaryKey().references(() => bookings.id, { onDelete: 'cascade' }),
  tenantId: tenantId(),
  ...timestamps,
})
