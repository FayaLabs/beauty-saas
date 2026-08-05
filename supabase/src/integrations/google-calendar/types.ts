// GERADO por scripts/functions-sync.mjs — NÃO EDITE AQUI.
// Fonte: plugin-agenda → src/integrations/google-calendar/types.ts
// Edite no repo do plugin e rode: npm run functions:sync
// Google Calendar integration — shared types.

export interface CalendarIntegration {
  id: string
  provider: string
  calendarId: string
  active: boolean
  connected: boolean
  lastSyncAt?: string
}

export interface CalendarSyncLogEntry {
  id: string
  direction: string
  trigger?: string
  status: string
  fetched: number
  written: number
  error?: string
  createdAt: string
}

/** Minimal Google Calendar event shape we read/write (subset of the API). */
export interface GCalEvent {
  id: string
  etag?: string
  summary?: string
  description?: string
  /** Timed events carry dateTime; all-day events carry only `date` (YYYY-MM-DD). */
  start: { dateTime?: string; date?: string; timeZone?: string }
  end: { dateTime?: string; date?: string; timeZone?: string }
  status?: string
  /** Set on instances expanded from a recurring series (singleEvents=true). */
  recurringEventId?: string
}

// ---------------------------------------------------------------------------
// Smart-sync: multi-calendar channels + wizard preview shapes
// ---------------------------------------------------------------------------

/** How a channel maps a Google calendar onto the agenda (de-para direction). */
export type ChannelDirection = 'inbound' | 'outbound' | 'bidirectional' | 'off'

/**
 * What the channel targets on the Fayz side. `null` (target_kind) means the
 * whole agenda; otherwise imports/exports scope to one assignee/service/location.
 */
export type ChannelTargetKind = 'assignee' | 'service' | 'location' | null

/** How inbound events materialize as appointments. */
export type ChannelImportMode = 'block' | 'appointment'

/**
 * A per-calendar sync channel (row of public.plg_calendar_channels). One Google
 * calendar ↔ one agenda target, with its own direction + incremental cursor.
 */
export interface CalendarChannel {
  id: string
  integrationId: string
  tenantId: string
  googleCalendarId: string
  summary: string | null
  color: string | null
  direction: ChannelDirection
  targetKind: ChannelTargetKind
  targetId: string | null
  importMode: ChannelImportMode
  syncToken: string | null
  channelId: string | null
  resourceId: string | null
  channelExpiresAt: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/** A future Google event not yet linked to an appointment — shown in the import wizard. */
export interface ExternalEventPreview {
  eventId: string
  etag: string
  summary: string
  startsAt: string
  endsAt: string
  allDay: boolean
  calendarId: string
  channelId: string
  recurring?: boolean
}

/** One entry from the Google calendarList (for the de-para picker). */
export interface GoogleCalendarListEntry {
  id: string
  summary: string
  backgroundColor?: string
  primary?: boolean
}

/** Result of an import_events run (per-item outcome tally). */
export interface ImportEventsResult {
  imported: number
  skipped: number
  errors: { eventId: string; error: string }[]
}

/**
 * Raw shape of a public.appointments row as the edge function / RPCs see it
 * (snake_case DB columns). Kept here so the pure mapping helpers can be shared
 * between the SDK client and the Deno edge function without a DB roundtrip type.
 */
export interface AppointmentRow {
  id: string
  tenant_id: string
  kind?: string | null
  assignee_id?: string | null
  location_id?: string | null
  starts_at: string
  ends_at?: string | null
  status?: string | null
  notes?: string | null
  metadata?: Record<string, any> | null
}

/** Raw shape of a public.plg_calendar_channels row (snake_case DB columns). */
export interface CalendarChannelRow {
  id: string
  integration_id: string
  tenant_id: string
  google_calendar_id: string
  summary?: string | null
  color?: string | null
  direction: ChannelDirection
  target_kind?: ChannelTargetKind
  target_id?: string | null
  import_mode?: ChannelImportMode
  sync_token?: string | null
  channel_id?: string | null
  resource_id?: string | null
  channel_expires_at?: string | null
  is_active?: boolean | null
  created_at?: string
  updated_at?: string
}
