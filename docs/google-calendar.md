# Google Calendar operations

The BeautySaaS app uses the Google Calendar control plane from
`@fayz-ai/plugin-agenda` and owns the two Supabase Edge Functions that hold the
OAuth credentials and execute provider calls.

## Project boundaries

- Supabase project: `gphxclpkbtbucoqclbco`
- Google Cloud project: `studied-indexer-501114-p3`
- OAuth callback:
  `https://gphxclpkbtbucoqclbco.supabase.co/functions/v1/google-calendar-sync`
- Webhook:
  `https://gphxclpkbtbucoqclbco.supabase.co/functions/v1/google-calendar-webhook`

Never commit OAuth client secrets, refresh tokens, access tokens, service keys,
or downloaded OAuth JSON files.

## Required Edge Function secrets

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GCAL_REDIRECT_URI`
- `GCAL_WEBHOOK_URI`
- `GCAL_WEBHOOK_AUTO_PULL=true`
- `VITE_APP_URL` for the deployed frontend origin

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are supplied by Supabase.
Local development return URLs are accepted only for HTTP origins on
`localhost`, `127.0.0.1`, or `[::1]`. Production origins must match
`VITE_APP_URL` or the comma-separated `GCAL_ALLOWED_ORIGINS`.

## Security model

`google-calendar-sync` has gateway JWT verification disabled because Google
returns the OAuth callback without a Supabase token. The function performs its
own checks:

1. Browser actions require a valid Supabase bearer token.
2. The authenticated user must belong to the requested tenant in
   `saas_core.tenant_members`.
3. OAuth state is HMAC-signed with a ten-minute lifetime and binds the user,
   tenant, nonce, and approved return URL.
4. Database trigger, webhook, and scheduled pulls require the Supabase service
   key and an explicit tenant ID.
5. Google webhook deliveries must match the stored channel ID, resource ID,
   token hash, and an increasing message number.

## Validation

Run the portable unit tests:

```sh
node --test supabase/functions/_shared/google-calendar-security.test.mjs \
  supabase/functions/_shared/google-calendar-mapping.test.mjs \
  supabase/functions/google-calendar-webhook/webhook.test.mjs
```

Before deploying, bundle both functions:

```sh
supabase functions deploy google-calendar-sync --project-ref gphxclpkbtbucoqclbco
supabase functions deploy google-calendar-webhook --project-ref gphxclpkbtbucoqclbco
```

Then test from the local app:

1. Start BeautySaaS with `npm run dev` (`http://localhost:5301`).
2. Sign in as a tenant member and open the Google Calendar integration.
3. Connect the Google test account and confirm the callback returns to the app.
4. Select a calendar and start or renew the watch channel.
5. Create and update an appointment, confirming one Google event is created and
   updated without an echo loop.
6. Change the Google event and confirm the linked appointment is updated once.
7. Confirm invalid origins, missing bearer tokens, and tenant IDs from another
   membership receive 4xx responses.

Only after the new client secret completes this smoke test should the previous
Google OAuth client secret be disabled and deleted.
