import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  saasCore,
  tenantId,
  timestamps,
  bookings,
  persons,
} from '@fayz-ai/saas/db'

const coreLocations = saasCore.table('locations', {
  id: uuid('id').primaryKey(),
})

const coreServices = saasCore.table('services', {
  id: uuid('id').primaryKey(),
})

// Ring-2 archetype extension: beauty appointments (booking archetype).
export const appointments = pgTable('appointments', {
  bookingId: uuid('booking_id').primaryKey().references(() => bookings.id, { onDelete: 'cascade' }),
  tenantId: tenantId(),
  cancellationReasonId: uuid('cancellation_reason_id').references(() => appointmentCancellationReasons.id),
  cancellationNotes: text('cancellation_notes'),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  confirmationStatus: text('confirmation_status').notNull().default('pending'),
  confirmationChannel: text('confirmation_channel'),
  confirmationSentAt: timestamp('confirmation_sent_at', { withTimezone: true }),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  executionStatus: text('execution_status').notNull().default('pending'),
  executionChecklist: jsonb('execution_checklist').$type<{
    forms?: boolean
    contracts?: boolean
    stock?: boolean
    invoice?: boolean
    notes?: string
  }>().notNull().default({}),
  stockDeductionStatus: text('stock_deduction_status').notNull().default('not_required'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps,
})

export const appointmentCancellationReasons = pgTable('appointment_cancellation_reasons', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantId(),
  name: text('name').notNull(),
  description: text('description'),
  requiresNotes: boolean('requires_notes').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps,
}, (table) => ({
  tenantActiveIdx: index('appointment_cancellation_reasons_tenant_active_idx').on(table.tenantId, table.isActive, table.sortOrder),
}))

export const appointmentConfirmationChannels = pgTable('appointment_confirmation_channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantId(),
  name: text('name').notNull(),
  channel: text('channel').notNull(),
  template: text('template'),
  sendOffsetHours: integer('send_offset_hours').notNull().default(24),
  retryOffsetHours: integer('retry_offset_hours'),
  isDefault: boolean('is_default').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps,
}, (table) => ({
  tenantActiveIdx: index('appointment_confirmation_channels_tenant_active_idx').on(table.tenantId, table.isActive, table.sortOrder),
}))

export const appointmentScheduleRules = pgTable('appointment_schedule_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantId(),
  name: text('name').notNull(),
  scope: text('scope').notNull().default('tenant'),
  locationId: uuid('location_id').references(() => coreLocations.id, { onDelete: 'set null' }),
  professionalId: uuid('professional_id').references(() => persons.id, { onDelete: 'set null' }),
  startTime: text('start_time').notNull().default('08:00'),
  endTime: text('end_time').notNull().default('20:00'),
  slotDurationMinutes: integer('slot_duration_minutes').notNull().default(30),
  bufferMinutes: integer('buffer_minutes').notNull().default(15),
  minAdvanceHours: integer('min_advance_hours').notNull().default(2),
  maxAdvanceDays: integer('max_advance_days').notNull().default(30),
  maxConcurrent: integer('max_concurrent').notNull().default(1),
  allowOnlineBooking: boolean('allow_online_booking').notNull().default(true),
  isActive: boolean('is_active').notNull().default(true),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps,
}, (table) => ({
  tenantScopeIdx: index('appointment_schedule_rules_tenant_scope_idx').on(table.tenantId, table.scope, table.isActive),
  professionalIdx: index('appointment_schedule_rules_professional_idx').on(table.professionalId),
}))

export const appointmentWaitlistEntries = pgTable('appointment_waitlist_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantId(),
  clientId: uuid('client_id').references(() => persons.id, { onDelete: 'set null' }),
  professionalId: uuid('professional_id').references(() => persons.id, { onDelete: 'set null' }),
  serviceId: uuid('service_id').references(() => coreServices.id, { onDelete: 'set null' }),
  locationId: uuid('location_id').references(() => coreLocations.id, { onDelete: 'set null' }),
  requestedDate: timestamp('requested_date', { withTimezone: true }),
  preferredStartTime: text('preferred_start_time'),
  preferredEndTime: text('preferred_end_time'),
  priority: integer('priority').notNull().default(0),
  status: text('status').notNull().default('waiting'),
  notes: text('notes'),
  convertedBookingId: uuid('converted_booking_id').references(() => bookings.id, { onDelete: 'set null' }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps,
}, (table) => ({
  tenantStatusIdx: index('appointment_waitlist_entries_tenant_status_idx').on(table.tenantId, table.status, table.requestedDate),
  clientIdx: index('appointment_waitlist_entries_client_idx').on(table.clientId),
}))
