# Testing Instructions

## Dev server

```
pnpm dev
```

App runs at `http://localhost:5180`

## Test credentials

- **Email:** teste@teste.com
- **Password:** teste123

## Playwright MCP testing

The Playwright MCP launches its own browser. To test the app:

1. Navigate to `http://localhost:5180` — redirects to `/#/login`
2. Fill email and password using the test credentials above
3. Submit the login form
4. After login, the app loads the dashboard with the sidebar/topbar shell

### Login flow

```
browser_navigate → http://localhost:5180
browser_snapshot → find email input, password input, submit button
browser_click → email input
browser_type → teste@teste.com
browser_click → password input
browser_type → teste123
browser_click → submit/sign in button
browser_wait_for → url change away from /login
browser_snapshot → verify app shell loaded
```

### Verifying UI changes

After making UI changes (e.g. i18n string extraction):

1. Login using the flow above
2. Navigate to the target page via `browser_navigate` or clicking nav items
3. Use `browser_snapshot` to get an accessibility tree — confirms text content rendered correctly
4. Use `browser_take_screenshot` for visual verification if needed

### Key routes

- `/#/` — Dashboard
- `/#/settings` — Settings
- `/#/registry/staff` — Staff registry (CRUD)
- `/#/registry/service-categories` — Service categories (CRUD, may be empty)
- `/#/agenda` — Agenda/calendar
- `/#/financial` — Financial plugin
