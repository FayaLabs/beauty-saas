export interface CalendarIntegration {
  id: string
  calendarId: string
  connected: boolean
  active: boolean
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
