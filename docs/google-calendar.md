# Google Calendar operations

BeautySaaS consumes the Google Calendar control plane, migrations, and canonical
Edge Function templates from `@fayz-ai/plugin-agenda`. The app keeps a deployment
copy under `supabase/functions` because Supabase deploys functions from the app
project. `npm run test:gcal:edge` fails if that copy drifts from the SDK template.

## Project boundaries

- Supabase project: `gphxclpkbtbucoqclbco`
- Google Cloud project: `studied-indexer-501114-p3`
- OAuth callback:
  `https://gphxclpkbtbucoqclbco.supabase.co/functions/v1/google-calendar-sync`
- Webhook:
  `https://gphxclpkbtbucoqclbco.supabase.co/functions/v1/google-calendar-webhook`

Never commit OAuth client secrets, refresh/access tokens, connector delivery
secrets, service-role keys, or downloaded OAuth JSON files. Report secret names,
never values.

## Runtime model

1. The settings connector starts OAuth and creates calendar/channel mappings.
2. The appointment trigger calls `google-calendar-sync` with `push_event`.
3. Google push notifications call `google-calendar-webhook`, which validates and
   deduplicates the delivery, then requests `pull_events`.
4. A 15-minute reconciliation job catches missed webhooks.
5. An hourly maintenance job renews Watches that are missing or expire within 24
   hours. A replacement Watch is started before the old Watch is stopped.
6. The visible Agenda subscribes to appointment changes through Realtime and also
   refreshes every 30 seconds while visible. The UI poll displays database changes;
   it does not replace the provider webhook or reconciliation job.

Outbound creates, updates, and cancellations are idempotent. A cancelled booking
deletes its linked Google event; an already missing event is treated as success.
Inbound pagination persists the final incremental `syncToken`. HTTP 410 resets an
expired cursor and establishes a new baseline without bulk-importing the initial
history window.

## Required Edge Function secrets

Both functions need the Supabase-provided `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`. Configure these connector secrets:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GCAL_REDIRECT_URI`
- `GCAL_WEBHOOK_URI`
- `GCAL_OUTBOUND_SECRET` (dedicated random delivery secret)
- `GCAL_WEBHOOK_AUTO_PULL=true`
- `VITE_APP_URL` for the deployed frontend origin
- `GCAL_ALLOWED_ORIGINS` for additional comma-separated production origins
- `GCAL_SYNC_FUNCTION_URL` only when the webhook must call a non-default URL

Local OAuth return URLs are accepted only for HTTP origins on `localhost`,
`127.0.0.1`, or `[::1]`. Production origins must match `VITE_APP_URL` or
`GCAL_ALLOWED_ORIGINS`.

The database needs two Vault entries. Their values must match the deployed
function URL and `GCAL_OUTBOUND_SECRET` respectively:

- `gcal_sync_url`
- `gcal_outbound_secret`

No service-role key is stored in Vault, `cron.job`, database settings, or SQL.

## Security model

Gateway JWT verification is disabled for both functions because Google invokes
the OAuth callback and webhook without a Supabase JWT. Application checks remain
mandatory:

1. Browser actions require a valid Supabase bearer token and tenant membership.
2. The OAuth callback requires a signed, tenant-bound, ten-minute state.
3. Trigger, webhook, and scheduled actions require `GCAL_OUTBOUND_SECRET` and an
   explicit tenant ID; the service-role key is never an internal bearer token.
4. Webhooks must match the stored channel ID, resource ID, token hash, and a
   monotonically increasing message number.
5. Database RPCs re-check tenant/channel ownership and connector tables use RLS.
6. Disconnect stops active Watches when possible before clearing tokens and
   cursors. A revoked Google token is tolerated and local credentials are still
   removed.

## Database rollout

The connector manifest embeds migrations from:

`plugins/plugin-agenda/src/integrations/google-calendar/migrations`

Migration `006_watch_maintenance_and_observability.sql` is additive and
idempotent. It enables `pg_cron`, `pg_net`, and `supabase_vault`; converges
webhook/outbox tables; adds RLS and indexes; and schedules:

- `gcal-reconcile-15m` — `*/15 * * * *`
- `gcal-renew-watches-hourly` — `17 * * * *`

Official pool status (`gphxclpkbtbucoqclbco`, 2026-07-28): migration 006
applied; both jobs active; both commands resolve their URL and delivery secret
through Vault; controlled reconciliation and Watch-maintenance calls returned
HTTP 200.

Before applying it to a live pool:

1. Inventory existing extensions, columns, policies, jobs, and Vault names.
2. Scan the SQL for destructive statements and report any match.
3. Deploy both new Edge Functions first so `renew_watches` exists.
4. Apply the migration once; then apply it again in QA to prove idempotency.
5. Verify both jobs are active and contain no literal credentials.

Never run a destructive repair against a live tenant. If the migration fails,
leave existing data in place, capture the exact error, and adjust with another
additive migration.

## Validation gates

### Local and safe remote checks

Copy `.env.google-calendar.example` to `.env.google-calendar.local` and fill
only the publishable Supabase key plus a dedicated QA user. Do not put a
service-role key or Google OAuth secret in that file.

Run:

```sh
npm run test:gcal
npm run typecheck
npm run build
npm run build:published-sdk
```

The Google Calendar gate covers security, mapping, retries/backoff, Watch renewal,
create/update/cancel, inbound reschedule/cancel, cursor reset, pagination,
webhook message ordering, app↔SDK template parity, Edge bundling, and a safe live
preflight. The preflight writes secret-free evidence to
`test-results/google-calendar-smoke.json`.

### Deploy to the official project

After reviewing the target and source diff:

```sh
supabase functions deploy google-calendar-sync --project-ref gphxclpkbtbucoqclbco
supabase functions deploy google-calendar-webhook --project-ref gphxclpkbtbucoqclbco
```

Do not deploy to another project reference. After deployment, run
`npm run test:gcal:preflight` before the connected E2E.

### Connected E2E

Use one disposable calendar and uniquely named QA events:

1. Complete OAuth and run `npm run test:gcal:connected`.
2. Select a calendar and start/renew its Watch.
3. Create, update, and cancel a BeautySaaS booking; verify one linked Google event
   is created, updated in place, and deleted without an echo loop.
4. Create, reschedule, and cancel a Google event; verify the linked appointment
   changes once without reloading the page.
5. Temporarily simulate or inspect a missed webhook and verify reconciliation
   catches it within 15 minutes.
6. Invoke Watch maintenance twice and verify the healthy Watch is reused.
7. Verify an invalid origin, missing bearer, wrong connector secret, and foreign
   tenant each receive a 4xx response.
8. Delete only the exact QA records/events created by this run.

## Health and troubleshooting

The connector health card reports:

- error when the latest sync failed;
- attention when no sync exists, the last sync is older than 45 minutes, no
  inbound mapping exists, a Watch is missing/within 24 hours of expiry, or the
  Google calendar timezone differs from the browser timezone;
- healthy only when none of those conditions applies.

Use structured Edge logs and `plg_calendar_sync_log` together. Correlate a run
by `correlation_id`, and webhook work by `channel_id_ref`. Expected recovery:

- `invalid_grant`: reconnect Google; the integration is deactivated safely.
- HTTP 410: the next pull establishes a new incremental cursor.
- HTTP 429/5xx: bounded retry honors `Retry-After`; reconciliation remains the
  fallback.
- missing/expiring Watch: run maintenance; do not delete the old Watch first.
- timezone warning: align the Google calendar and business/browser timezone
  before treating displayed hours as an integration bug.

Rollback Edge code to the previously known-good function version if needed, but
do not roll back additive schema by dropping tables or columns. Disable a faulty
cron job while preserving its rows and evidence, then ship a corrective migration.
