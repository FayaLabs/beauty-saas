import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-worker-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/calendar/v3";
const ORIGIN = "google-calendar";
const env = (key: string) => Deno.env.get(key) ?? "";
const admin = () =>
  createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

function b64url(input: Uint8Array | string): string {
  const bytes = typeof input === "string"
    ? new TextEncoder().encode(input)
    : input;
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(
    /\//g,
    "_",
  ).replace(/=+$/, "");
}
function decode(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
    .buffer as ArrayBuffer;
}
async function hmac(payload: string): Promise<string> {
  const secret = env("GCAL_STATE_SECRET");
  if (!secret) throw new Error("GCAL_STATE_SECRET não configurado");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return b64url(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)),
    ),
  );
}
async function makeState(value: unknown): Promise<string> {
  const payload = b64url(JSON.stringify(value));
  return `${payload}.${await hmac(payload)}`;
}
async function readState(state: string): Promise<any> {
  const [payload, supplied] = state.split(".");
  if (!payload || !supplied || supplied !== await hmac(payload)) {
    throw new Error("Estado OAuth inválido");
  }
  const value = JSON.parse(new TextDecoder().decode(decode(payload)));
  if (!value.exp || value.exp < Date.now()) {
    throw new Error("Estado OAuth expirado");
  }
  return value;
}
async function encryptionKey(): Promise<CryptoKey> {
  const secret = env("GCAL_TOKEN_ENCRYPTION_KEY");
  if (!secret) throw new Error("GCAL_TOKEN_ENCRYPTION_KEY não configurado");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
async function encryptToken(value?: string | null): Promise<string | null> {
  if (!value) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(),
    new TextEncoder().encode(value),
  );
  return `v1.${b64url(iv)}.${b64url(new Uint8Array(encrypted))}`;
}
async function decryptToken(value?: string | null): Promise<string | null> {
  if (!value) return null;
  if (!value.startsWith("v1.")) return value; // migration compatibility; reconnect rewrites encrypted.
  try {
    const [, iv, cipher] = value.split(".");
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: decode(iv) },
      await encryptionKey(),
      decode(cipher),
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error(
      "Credenciais Google incompatíveis com a chave atual; desconecte e conecte novamente",
    );
  }
}
function allowedRedirect(raw: string): string {
  const target = new URL(raw || "http://localhost:5180");
  const allowed =
    (env("GCAL_ALLOWED_REDIRECT_ORIGINS") || "http://localhost:5180").split(",")
      .map((v) => v.trim());
  if (!allowed.includes(target.origin)) {
    throw new Error("URL de retorno não permitida");
  }
  return target.toString();
}
async function authenticatedTenant(req: Request, tenantId: string) {
  if (!tenantId) throw new Error("Tenant não informado");
  const authorization = req.headers.get("Authorization") ?? "";
  const userClient = createClient(
    env("SUPABASE_URL"),
    env("SUPABASE_ANON_KEY"),
    { global: { headers: { Authorization: authorization } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) throw new Error("Sessão inválida");
  const db = admin();
  const { data } = await db.schema("saas_core").from("tenant_members").select(
    "tenant_id",
  ).eq("tenant_id", tenantId).eq("user_id", user.id).maybeSingle();
  if (!data) throw new Error("Usuário não pertence ao tenant selecionado");
  return db;
}
function consentUrl(state: string): string {
  return `${AUTH}?${
    new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"),
      redirect_uri: env("GCAL_REDIRECT_URI"),
      response_type: "code",
      scope: "https://www.googleapis.com/auth/calendar.events",
      access_type: "offline",
      prompt: "consent",
      state,
    }).toString()
  }`;
}
async function tokenRequest(body: Record<string, string>) {
  const response = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const value = await response.json();
  if (!response.ok) {
    throw new Error(
      `Google OAuth ${value.error ?? response.status}: ${
        value.error_description ?? "Falha na autenticação"
      }`,
    );
  }
  return value;
}
async function accessToken(db: any, integration: any): Promise<string> {
  const current = await decryptToken(integration.oauth_access_token);
  if (
    current &&
    new Date(integration.token_expires_at ?? 0).getTime() > Date.now() + 60_000
  ) return current;
  const refresh = await decryptToken(integration.oauth_refresh_token);
  if (!refresh) throw new Error("Google Calendar não conectado");
  const token = await tokenRequest({
    refresh_token: refresh,
    client_id: env("GOOGLE_CLIENT_ID"),
    client_secret: env("GOOGLE_CLIENT_SECRET"),
    grant_type: "refresh_token",
  });
  await db.from("calendar_integrations").update({
    oauth_access_token: await encryptToken(token.access_token),
    token_expires_at: new Date(Date.now() + token.expires_in * 1000)
      .toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", integration.id);
  return token.access_token;
}
async function google(token: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (response.status === 204) return {};
  const text = await response.text();
  if (!response.ok) {
    const error = new Error(
      `Google Calendar ${response.status}: ${text.slice(0, 500)}`,
    ) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return text ? JSON.parse(text) : {};
}
async function integrationFor(db: any, tenantId: string) {
  const { data } = await db.from("calendar_integrations").select("*").eq(
    "tenant_id",
    tenantId,
  ).eq("provider", "google").eq("active", true).maybeSingle();
  if (!data?.oauth_refresh_token) {
    throw new Error("Google Calendar não conectado");
  }
  return data;
}
async function clearIntegrationCredentials(db: any, integrationId: string) {
  await db.from("calendar_integrations").update({
    active: false,
    oauth_refresh_token: null,
    oauth_access_token: null,
    token_expires_at: null,
    sync_token: null,
    watch_channel_id: null,
    watch_resource_id: null,
    watch_token: null,
    watch_expires_at: null,
    updated_at: new Date().toISOString(),
  }).eq("id", integrationId);
}
async function ensureWorkerConfig(db: any) {
  const endpointUrl = env("GCAL_WEBHOOK_URL");
  if (!endpointUrl.startsWith("https://")) {
    throw new Error("GCAL_WEBHOOK_URL HTTPS não configurada");
  }
  const { error } = await db.from("calendar_worker_config").upsert({
    id: true,
    endpoint_url: endpointUrl,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    throw new Error(`Falha ao configurar endpoint do worker: ${error.message}`);
  }
}
function isRevokedCredential(error: unknown): boolean {
  const message = error instanceof Error
    ? error.message.toLowerCase()
    : String(error).toLowerCase();
  return (error as any)?.status === 401 ||
    message.includes("invalid_grant") ||
    message.includes("expired or revoked") ||
    message.includes("incompatíveis com a chave atual");
}
async function validateIntegrationCredential(db: any, integration: any) {
  const token = await accessToken(db, integration);
  const calendar = encodeURIComponent(integration.calendar_id || "primary");
  await google(
    token,
    `/calendars/${calendar}/events?maxResults=1&singleEvents=true`,
  );
}
async function stopWatch(db: any, integration: any) {
  if (!integration.watch_channel_id || !integration.watch_resource_id) return;
  try {
    await google(await accessToken(db, integration), "/channels/stop", {
      method: "POST",
      body: JSON.stringify({
        id: integration.watch_channel_id,
        resourceId: integration.watch_resource_id,
      }),
    });
  } catch (error) {
    console.warn("[google-calendar] stop channel", error);
  }
}
async function startWatch(db: any, integration: any) {
  const callback = env("GCAL_WEBHOOK_URL");
  if (!callback.startsWith("https://")) {
    throw new Error("GCAL_WEBHOOK_URL HTTPS não configurada");
  }
  await stopWatch(db, integration);
  const channelId = crypto.randomUUID();
  const channelToken = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const token = await accessToken(db, integration);
  const calendar = encodeURIComponent(integration.calendar_id);
  const channel = await google(token, `/calendars/${calendar}/events/watch`, {
    method: "POST",
    body: JSON.stringify({
      id: channelId,
      type: "web_hook",
      address: callback,
      token: channelToken,
      params: { ttl: "604800" },
    }),
  });
  await db.from("calendar_integrations").update({
    watch_channel_id: channelId,
    watch_resource_id: channel.resourceId,
    watch_token: channelToken,
    watch_expires_at: channel.expiration
      ? new Date(Number(channel.expiration)).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  }).eq("id", integration.id);
}
async function command(db: any, name: string, args: Record<string, unknown>) {
  const { data, error } = await db.schema("saas_core").rpc(name, args);
  if (error) {
    throw new Error(
      `${name}: ${error.message}${error.details ? ` (${error.details})` : ""}`,
    );
  }
  return data;
}
async function applyGoogleEvent(
  db: any,
  integration: any,
  event: any,
): Promise<boolean> {
  const correlation = crypto.randomUUID();
  if (event.status === "cancelled") {
    return Boolean(
      await command(db, "command_delete_external_booking", {
        p_tenant_id: integration.tenant_id,
        p_external_id: event.id,
        p_origin: ORIGIN,
        p_correlation_id: correlation,
      }),
    );
  }
  if (!event.start?.dateTime) return false; // all-day events are intentionally not mapped to staff blocks.
  let bookingId = event.extendedProperties?.private?.beautyBookingId;
  if (bookingId) {
    const { data: booking } = await db.schema("saas_core").from("bookings")
      .select("id")
      .eq("tenant_id", integration.tenant_id).eq("id", bookingId).maybeSingle();
    if (!booking) {
      // A Google event created by this tenant may outlive a locally deleted
      // booking until its outbound delete job runs. Never resurrect it or let
      // the stale private reference abort the incremental batch.
      if (
        event.extendedProperties?.private?.beautyTenantId ===
          integration.tenant_id
      ) return false;
      bookingId = undefined;
    }
  }
  if (!bookingId) {
    const { data: linked } = await db.schema("saas_core").from("bookings")
      .select("id").eq("tenant_id", integration.tenant_id).contains(
        "metadata",
        { googleCalendarEventId: event.id },
      ).maybeSingle();
    bookingId = linked?.id;
  }
  if (bookingId) {
    await command(db, "command_update_booking", {
      p_tenant_id: integration.tenant_id,
      p_booking_id: bookingId,
      p_patch: {
        starts_at: event.start.dateTime,
        ends_at: event.end?.dateTime ?? null,
        notes: event.summary ?? null,
      },
      p_origin: ORIGIN,
      p_correlation_id: correlation,
    });
    return true;
  }
  let assigneeId = integration.mapped_assignee_id;
  if (!assigneeId) {
    const { data: staff } = await db.schema("saas_core").from("persons").select(
      "id",
    ).eq("tenant_id", integration.tenant_id).eq("kind", "staff").eq(
      "is_active",
      true,
    ).order("created_at").limit(2);
    if ((staff ?? []).length === 1) assigneeId = staff[0].id;
  }
  if (!assigneeId) {
    await db.from("calendar_sync_log").insert({
      tenant_id: integration.tenant_id,
      direction: "inbound",
      trigger: "webhook",
      status: "partial",
      fetched: 1,
      written: 0,
      error:
        "Evento ignorado: é necessário mapear o calendário para um profissional.",
    });
    return false;
  }
  await command(db, "command_import_external_block", {
    p_tenant_id: integration.tenant_id,
    p_assignee_id: assigneeId,
    p_starts_at: event.start.dateTime,
    p_ends_at: event.end?.dateTime ?? event.start.dateTime,
    p_title: event.summary || "Compromisso do Google Calendar",
    p_external_id: event.id,
    p_origin: ORIGIN,
    p_correlation_id: correlation,
  });
  return true;
}
async function incrementalSync(db: any, integration: any, trigger = "webhook") {
  const token = await accessToken(db, integration);
  const calendar = encodeURIComponent(integration.calendar_id);
  let pageToken: string | undefined;
  let fetched = 0;
  let written = 0;
  let nextSyncToken: string | undefined;
  const run = async (useCursor: boolean) => {
    pageToken = undefined;
    fetched = 0;
    written = 0;
    nextSyncToken = undefined;
    do {
      const params = new URLSearchParams({
        singleEvents: "true",
        showDeleted: "true",
        maxResults: "2500",
      });
      if (useCursor && integration.sync_token) {
        params.set("syncToken", integration.sync_token);
      }
      if (!useCursor) {
        params.set(
          "timeMin",
          new Date(Date.now() - 30 * 86400_000).toISOString(),
        );
      }
      if (pageToken) params.set("pageToken", pageToken);
      const page = await google(
        token,
        `/calendars/${calendar}/events?${params}`,
      );
      for (const event of page.items ?? []) {
        fetched++;
        if (await applyGoogleEvent(db, integration, event)) written++;
      }
      pageToken = page.nextPageToken;
      nextSyncToken = page.nextSyncToken ?? nextSyncToken;
    } while (pageToken);
  };
  try {
    await run(Boolean(integration.sync_token));
  } catch (error) {
    if ((error as any).status !== 410) throw error;
    await db.from("calendar_integrations").update({ sync_token: null }).eq(
      "id",
      integration.id,
    );
    integration.sync_token = null;
    await run(false);
  }
  await db.from("calendar_integrations").update({
    sync_token: nextSyncToken,
    sync_cursor_updated_at: new Date().toISOString(),
    last_sync_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", integration.id);
  await db.from("calendar_sync_log").insert({
    tenant_id: integration.tenant_id,
    direction: "inbound",
    trigger,
    fetched,
    written,
  });
  return { fetched, written };
}
async function seedOutbound(db: any, tenantId: string) {
  const { data: bookings, error } = await db.schema("saas_core").from(
    "bookings",
  ).select("*")
    .eq("tenant_id", tenantId).eq("kind", "appointment").neq(
      "status",
      "cancelled",
    )
    .gte("starts_at", new Date().toISOString());
  if (error) throw error;
  if (!(bookings ?? []).length) return 0;
  const events = bookings.map((booking: any) => ({
    tenant_id: tenantId,
    aggregate_type: "booking",
    aggregate_id: booking.id,
    event_type: "booking.updated",
    origin: "agenda",
    correlation_id: crypto.randomUUID(),
    payload: { booking },
  }));
  const { error: insertError } = await db.schema("saas_core").from(
    "domain_events",
  ).insert(events);
  if (insertError) throw insertError;
  return events.length;
}
function eventBody(booking: any, tenantId: string) {
  const metadata = booking.metadata ?? {};
  return {
    summary: metadata.serviceNames || metadata.contactName || booking.notes ||
      "Agendamento BeautySaaS",
    description: booking.notes ?? undefined,
    start: { dateTime: booking.starts_at },
    end: { dateTime: booking.ends_at ?? booking.starts_at },
    extendedProperties: {
      private: { beautyBookingId: booking.id, beautyTenantId: tenantId },
    },
  };
}
async function deterministicEventId(
  tenantId: string,
  bookingId: string,
): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${tenantId}:${bookingId}`),
    ),
  );
  return `bs${
    Array.from(digest).map((value) => value.toString(16).padStart(2, "0")).join(
      "",
    ).slice(0, 50)
  }`;
}
async function deliverOutboxItem(db: any, item: any) {
  const integration = await integrationFor(db, item.tenant_id);
  const token = await accessToken(db, integration);
  const calendar = encodeURIComponent(integration.calendar_id);
  const booking = item.payload?.booking ?? {};
  const eventId = booking.metadata?.googleCalendarEventId;
  if (
    item.event_type === "booking.deleted" ||
    item.event_type === "booking.cancelled"
  ) {
    if (eventId) {
      try {
        await google(
          token,
          `/calendars/${calendar}/events/${encodeURIComponent(eventId)}`,
          { method: "DELETE" },
        );
      } catch (error) {
        if (![404, 410].includes((error as any).status)) throw error;
      }
    }
    return;
  }
  if (booking.kind !== "appointment") return;
  const stableEventId = eventId ||
    await deterministicEventId(item.tenant_id, item.aggregate_id);
  let saved;
  if (eventId) {
    saved = await google(
      token,
      `/calendars/${calendar}/events/${encodeURIComponent(eventId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(eventBody(booking, item.tenant_id)),
      },
    );
  } else {
    try {
      saved = await google(token, `/calendars/${calendar}/events`, {
        method: "POST",
        body: JSON.stringify({
          id: stableEventId,
          ...eventBody(booking, item.tenant_id),
        }),
      });
    } catch (error) {
      if ((error as any).status !== 409) throw error;
      saved = await google(
        token,
        `/calendars/${calendar}/events/${stableEventId}`,
        {
          method: "PATCH",
          body: JSON.stringify(eventBody(booking, item.tenant_id)),
        },
      );
    }
  }
  if (!eventId && saved.id) {
    await command(db, "command_link_external_event", {
      p_tenant_id: item.tenant_id,
      p_booking_id: item.aggregate_id,
      p_external_id: saved.id,
      p_origin: ORIGIN,
      p_correlation_id: item.correlation_id,
    });
  }
}
async function processOutbox(db: any, limit = 25, tenantId?: string) {
  const claim = tenantId
    ? "claim_google_calendar_outbox_for_tenant"
    : "claim_google_calendar_outbox";
  const args = tenantId
    ? { p_tenant_id: tenantId, p_limit: limit }
    : { p_limit: limit };
  const { data: items, error } = await db.rpc(claim, args);
  if (error) throw error;
  let completed = 0;
  let failed = 0;
  for (const item of items ?? []) {
    try {
      await deliverOutboxItem(db, item);
      await db.from("calendar_event_outbox").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        locked_at: null,
        last_error: null,
      }).eq("id", item.id);
      completed++;
    } catch (error) {
      const attempts = item.attempts ?? 1;
      const dead = attempts >= 8;
      const delaySeconds = Math.min(3600, 2 ** Math.min(attempts, 10) * 5);
      await db.from("calendar_event_outbox").update({
        status: dead ? "dead" : "pending",
        available_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
        locked_at: null,
        last_error: error instanceof Error
          ? error.message.slice(0, 1000)
          : String(error).slice(0, 1000),
      }).eq("id", item.id);
      failed++;
    }
  }
  return { claimed: items?.length ?? 0, completed, failed };
}
async function processWebhookInbox(db: any, limit = 10) {
  const { data: items, error } = await db.rpc(
    "claim_google_calendar_webhooks",
    { p_limit: limit },
  );
  if (error) throw error;
  let completed = 0;
  let failed = 0;
  for (const item of items ?? []) {
    try {
      const { data: integration } = await db.from("calendar_integrations")
        .select("*").eq("id", item.integration_id).eq("active", true).single();
      await incrementalSync(db, integration, "webhook");
      await db.from("calendar_webhook_inbox").update({
        status: "completed",
        locked_at: null,
        last_error: null,
      }).eq("id", item.id);
      completed++;
    } catch (error) {
      const attempts = item.attempts ?? 1;
      const dead = attempts >= 8;
      await db.from("calendar_webhook_inbox").update({
        status: dead ? "dead" : "pending",
        available_at: new Date(
          Date.now() + Math.min(3600, 2 ** attempts * 5) * 1000,
        ).toISOString(),
        locked_at: null,
        last_error: error instanceof Error
          ? error.message.slice(0, 1000)
          : String(error).slice(0, 1000),
      }).eq("id", item.id);
      failed++;
    }
  }
  return { claimed: items?.length ?? 0, completed, failed };
}
async function renewExpiringWatches(db: any) {
  const deadline = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
  const { data: integrations, error } = await db.from("calendar_integrations")
    .select("*")
    .eq("provider", "google").eq("active", true).not(
      "oauth_refresh_token",
      "is",
      null,
    )
    .or(`watch_expires_at.is.null,watch_expires_at.lt.${deadline}`);
  if (error) throw error;
  let renewed = 0;
  for (const integration of integrations ?? []) {
    await startWatch(db, integration);
    renewed++;
  }
  return renewed;
}
async function handleWebhook(req: Request) {
  const channelId = req.headers.get("X-Goog-Channel-ID");
  const resourceId = req.headers.get("X-Goog-Resource-ID");
  const channelToken = req.headers.get("X-Goog-Channel-Token");
  if (!channelId || !resourceId || !channelToken) return null;
  const db = admin();
  const { data: integration } = await db.from("calendar_integrations").select(
    "*",
  ).eq("watch_channel_id", channelId).eq("watch_resource_id", resourceId).eq(
    "watch_token",
    channelToken,
  ).eq("active", true).maybeSingle();
  if (!integration) return json({ error: "Canal inválido" }, 401);
  if (req.headers.get("X-Goog-Resource-State") !== "sync") {
    const messageNumber = Number(req.headers.get("X-Goog-Message-Number"));
    if (!Number.isSafeInteger(messageNumber)) {
      return json({ error: "Notificação inválida" }, 400);
    }
    await db.from("calendar_webhook_inbox").upsert({
      integration_id: integration.id,
      channel_id: channelId,
      message_number: messageNumber,
    }, { onConflict: "channel_id,message_number", ignoreDuplicates: true });
    (globalThis as any).EdgeRuntime?.waitUntil(
      processWebhookInbox(db).catch((error: unknown) =>
        console.error("[google-calendar-webhook]", error)
      ),
    );
  }
  return new Response(null, { status: 204 });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const webhook = await handleWebhook(req);
    if (webhook) return webhook;
    const url = new URL(req.url);
    if (req.method === "GET" && url.searchParams.has("code")) {
      const state = await readState(url.searchParams.get("state") ?? "");
      const db = admin();
      await ensureWorkerConfig(db);
      const token = await tokenRequest({
        code: url.searchParams.get("code")!,
        client_id: env("GOOGLE_CLIENT_ID"),
        client_secret: env("GOOGLE_CLIENT_SECRET"),
        redirect_uri: env("GCAL_REDIRECT_URI"),
        grant_type: "authorization_code",
      });
      if (!token.refresh_token) {
        throw new Error(
          "Google não retornou refresh token; revogue o acesso anterior e tente novamente",
        );
      }
      const { data: integration, error } = await db.from(
        "calendar_integrations",
      ).upsert({
        tenant_id: state.tenantId,
        provider: "google",
        oauth_refresh_token: await encryptToken(token.refresh_token),
        oauth_access_token: await encryptToken(token.access_token),
        token_expires_at: new Date(Date.now() + token.expires_in * 1000)
          .toISOString(),
        sync_token: null,
        active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "tenant_id,provider" }).select("*").single();
      if (error) throw error;
      await incrementalSync(db, integration, "oauth");
      await seedOutbound(db, state.tenantId);
      await startWatch(db, { ...integration, sync_token: null });
      return Response.redirect(allowedRedirect(state.redirectTo), 302);
    }
    if (req.method !== "POST") {
      return json({ error: "Método não permitido" }, 405);
    }
    const body = await req.json();
    const validWorker =
      req.headers.get("X-Worker-Secret") === env("GCAL_WORKER_SECRET") &&
      Boolean(env("GCAL_WORKER_SECRET"));
    const isOutboxWebhook = body.type === "INSERT" &&
      body.table === "calendar_event_outbox";
    if (validWorker && (body.action === "process_outbox" || isOutboxWebhook)) {
      const db = admin();
      await ensureWorkerConfig(db);
      return json({
        outbound: await processOutbox(db, body.limit),
        inbound: await processWebhookInbox(db, body.limit),
        watchesRenewed: await renewExpiringWatches(db),
      });
    }
    const db = await authenticatedTenant(req, body.tenantId);
    await ensureWorkerConfig(db);
    if (body.action === "oauth_start") {
      return json({
        url: consentUrl(
          await makeState({
            tenantId: body.tenantId,
            redirectTo: allowedRedirect(body.redirectTo),
            exp: Date.now() + 10 * 60_000,
          }),
        ),
      });
    }
    if (body.action === "status") {
      const { data } = await db.from("calendar_integrations").select("*").eq(
        "tenant_id",
        body.tenantId,
      ).eq("provider", "google").maybeSingle();
      if (data?.active && data.oauth_refresh_token) {
        try {
          await validateIntegrationCredential(db, data);
        } catch (error) {
          if (isRevokedCredential(error)) {
            await clearIntegrationCredentials(db, data.id);
            data.active = false;
            data.oauth_refresh_token = null;
            data.oauth_access_token = null;
          } else {
            console.warn(
              "[google-calendar-status] credential check skipped",
              error,
            );
          }
        }
      }
      return json({
        integration: data
          ? {
            id: data.id,
            calendarId: data.calendar_id ?? "primary",
            active: data.active ?? true,
            connected: Boolean(data.active && data.oauth_refresh_token),
            lastSyncAt: data.last_sync_at ?? undefined,
            watchExpiresAt: data.watch_expires_at ?? undefined,
            mappedAssigneeId: data.mapped_assignee_id ?? undefined,
          }
          : null,
      });
    }
    if (body.action === "health") {
      await db.rpc("refresh_google_calendar_operational_alerts");
      const { data: health, error } = await db.rpc(
        "get_google_calendar_health",
        { p_tenant_id: body.tenantId },
      );
      if (error) throw error;
      return json({ health });
    }
    if (body.action === "disconnect") {
      const integration = await integrationFor(db, body.tenantId);
      await stopWatch(db, integration);
      let credential: string | null = null;
      let credentialUnreadable = false;
      try {
        credential = await decryptToken(integration.oauth_refresh_token) ??
          await decryptToken(integration.oauth_access_token);
      } catch {
        // Key rotation without token re-encryption makes the old credential
        // unrecoverable. Local disconnect must still succeed so the tenant can
        // reconnect; Google-side access should then be reviewed by the user.
        credentialUnreadable = true;
      }
      if (credential) {
        const revoke = await fetch("https://oauth2.googleapis.com/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: credential }),
        });
        if (!revoke.ok && revoke.status !== 400) {
          throw new Error(
            `Google não confirmou a revogação (${revoke.status})`,
          );
        }
      }
      await clearIntegrationCredentials(db, integration.id);
      return json({
        ok: true,
        revokedAtGoogle: Boolean(credential),
        credentialUnreadable,
      });
    }
    if (body.action === "set_calendar") {
      const integration = await integrationFor(db, body.tenantId);
      const requestedCalendar = body.calendarId || "primary";
      if (integration.calendar_id === requestedCalendar) {
        return json({ ok: true, changed: false });
      }
      await stopWatch(db, integration);
      const { data: updated, error } = await db.from("calendar_integrations")
        .update({
          calendar_id: requestedCalendar,
          sync_token: null,
          updated_at: new Date().toISOString(),
        }).eq("id", integration.id).select("*").single();
      if (error) throw new Error(error.message);
      await incrementalSync(db, updated, "calendar_changed");
      await seedOutbound(db, body.tenantId);
      await startWatch(db, updated);
      return json({ ok: true });
    }
    if (body.action === "pull_events") {
      const outbound = await processOutbox(db, 100, body.tenantId);
      const inbound = await incrementalSync(
        db,
        await integrationFor(db, body.tenantId),
        body.trigger || "manual",
      );
      return json({ ...inbound, outbound });
    }
    if (body.action === "mapping_options") {
      const { data, error } = await db.schema("saas_core").from("persons")
        .select("id,name").eq("tenant_id", body.tenantId).eq("kind", "staff")
        .eq("is_active", true).order("name");
      if (error) throw error;
      return json({ professionals: data ?? [] });
    }
    if (body.action === "set_mapping") {
      if (body.assigneeId) {
        const { data: professional } = await db.schema("saas_core").from(
          "persons",
        ).select("id").eq("id", body.assigneeId).eq("tenant_id", body.tenantId)
          .eq("kind", "staff").eq("is_active", true).maybeSingle();
        if (!professional) {
          throw new Error("Profissional inválido para este tenant");
        }
      }
      const { error } = await db.from("calendar_integrations").update({
        mapped_assignee_id: body.assigneeId || null,
        updated_at: new Date().toISOString(),
      }).eq("tenant_id", body.tenantId).eq("provider", "google");
      if (error) throw error;
      return json({ ok: true });
    }
    if (body.action === "renew_watch") {
      const integration = await integrationFor(db, body.tenantId);
      await startWatch(db, integration);
      return json({ ok: true });
    }
    return json({ error: "Ação desconhecida" }, 400);
  } catch (error) {
    console.error("[google-calendar-sync]", error);
    return json({
      error: error instanceof Error ? error.message : "Erro interno",
    }, 400);
  }
});
