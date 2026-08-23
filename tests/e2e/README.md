Browser tests for the Start form / Cloudflare Turnstile integration.

**Invariant: no test in this directory may reach a real Cloudflare, Supabase, or Resend endpoint.** Every test either blocks the real Turnstile script and substitutes `turnstile-mock.ts`'s synthetic `window.turnstile`, or intercepts `**/api/inquiries` (or both). If you add a test here, keep that invariant — do not remove a `page.route(...)` interception to "test the real thing"; that belongs in manual/staging verification, not this suite.

Run:

```
npx playwright install chromium   # one-time, downloads the browser to a local cache outside the repo
npm run dev                       # in one terminal — or let Playwright start it (see playwright.config.ts webServer)
npm run test:e2e                  # in another terminal
```

Browser binaries are never committed; they install to a local cache (`~/.cache/ms-playwright` or `%LOCALAPPDATA%\ms-playwright` on Windows), not into `node_modules` or the repo.
