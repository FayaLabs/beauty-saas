export interface CalendarIntegration {
  id: string
  calendarId: string
  connected: boolean
  active: boolean
  lastSyncAt?: string
  watchExpiresAt?: string
  mappedAssigneeId?: string
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

export interface CalendarOperationalAlert {
  id: string
  code: string
  severity: "warning" | "critical"
  message: string
  details: Record<string, unknown>
  lastSeenAt: string
}

export interface CalendarIntegrationHealth {
  lastSyncAt?: string
  watchExpiresAt?: string
  outboxPending: number
  outboxDead: number
  oldestOutboxAt?: string
  inboxPending: number
  inboxDead: number
  oldestInboxAt?: string
  alerts: CalendarOperationalAlert[]
}
