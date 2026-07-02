import { getActiveTenantId, getSupabaseClientOptional } from "@fayz-ai/saas";
import type { CalendarIntegration, CalendarSyncLogEntry } from "../types";

const FUNCTION = "google-calendar-sync";

function client(): any {
  const value = getSupabaseClientOptional();
  if (!value) throw new Error("Supabase não inicializado");
  return value;
}

function tenantId(): string {
  const value = getActiveTenantId();
  if (!value) {
    throw new Error("Selecione um salão antes de conectar o Google Calendar");
  }
  return value;
}

async function waitForTenantId(timeoutMs = 3000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  do {
    const value = getActiveTenantId();
    if (value) return value;
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  } while (Date.now() < deadline);
  throw new Error("Selecione um salão antes de usar o Google Calendar");
}

async function invoke<T>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const activeTenantId = await waitForTenantId();
  const { data, error } = await client().functions.invoke(FUNCTION, {
    body: { action, tenantId: activeTenantId, ...payload },
  });
  if (error) {
    const response = (error as any).context as Response | undefined;
    if (response) {
      try {
        const details = await response.clone().json();
        if (details?.error) throw new Error(details.error);
      } catch (detailsError) {
        if (
          detailsError instanceof Error &&
          detailsError.message !== "Unexpected end of JSON input"
        ) {
          throw detailsError;
        }
      }
    }
    throw new Error(error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export function createGoogleCalendarProvider() {
  return {
    async getIntegration(): Promise<CalendarIntegration | null> {
      const data = await invoke<{
        integration: CalendarIntegration | null;
      }>("status");
      return data.integration;
    },
    async getConnectUrl(redirectTo = window.location.href) {
      return (await invoke<{ url: string }>("oauth_start", { redirectTo })).url;
    },
    async setCalendar(calendarId: string) {
      await invoke("set_calendar", { calendarId });
    },
    async getMappingOptions() {
      return invoke<{ professionals: Array<{ id: string; name: string }> }>(
        "mapping_options",
      );
    },
    async setMapping(assigneeId: string) {
      await invoke("set_mapping", { assigneeId });
    },
    async disconnect() {
      await invoke("disconnect");
    },
    async syncNow() {
      return invoke<{ fetched: number; written: number }>("pull_events", {
        trigger: "manual",
      });
    },
    async getSyncLog(): Promise<CalendarSyncLogEntry[]> {
      const { data, error } = await client().from("calendar_sync_log").select(
        "*",
      )
        .eq("tenant_id", tenantId()).order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        id: row.id,
        direction: row.direction,
        trigger: row.trigger ?? undefined,
        status: row.status,
        fetched: row.fetched ?? 0,
        written: row.written ?? 0,
        error: row.error ?? undefined,
        createdAt: row.created_at,
      }));
    },
  };
}
