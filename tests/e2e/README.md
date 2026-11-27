Browser tests for the Start form / Cloudflare Turnstile integration.

**Invariant: no test in this directory may reach a real Cloudflare, Supabase, or Resend endpoint.** Every test either blocks the real Turnstile script and substitutes `turnstile-mock.ts`'s synthetic `window.turnstile`, or intercepts `**/api/inquiries` (or both). If you add a test here, keep that invariant — do not remove a `page.route(...)` interception to "test the real thing"; that belongs in manual/staging verification, not this suite.

Run:

```
npx playwright install chromium   # one-time, downloads the browser to a local cache outside the repo
npm run dev                       # in one terminal — or let Playwright start it (see playwright.config.ts webServer)
npm run test:e2e                  # in another terminal
```

Browser binaries are never committed; they install to a local cache (`~/.cache/ms-playwright` or `%LOCALAPPDATA%\ms-playwright` on Windows), not into `node_modules` or the repo.

## A reliable clean run

In a fresh checkout or worktree (no `.next` folder, nothing listening on port 3000):

```
npm ci
npx playwright install chromium   # one-time per machine
npm run test:e2e
```

The first complete run is a trustworthy result. Do not discard a first run and rely on a second one.

How it stays reliable (issue #75): the Next dev server rewrites `.next/dev/prerender-manifest.json`, without a lock, the first time each dynamic page is requested. Parallel workers reaching un-warmed pages at the same moment used to interleave those writes, corrupt the file, and make over a hundred unrelated tests fail with a 500. So:

- `global-setup.ts` requests every page under `src/app/[locale]` once, in both locales, one after the other, before any worker starts. The list comes from the file system, so a new page is covered automatically. A page that answers 400 or above stops the run and names the page; nothing is retried. The generated manifests must also parse afterwards.
- `global-teardown.ts` checks the manifests again after the run. If they were corrupted, the run fails with a message saying the results cannot be trusted and are not a product failure.
- A page with a dynamic segment (for example `[slug]`) cannot be warmed without a value, so adding one makes the setup fail until a warm-up path is added in `global-setup.ts`.
- The helpers are unit tested in `dev-server-state.unit.ts`, which `npm test` runs (it is not named `.test.ts` or `.spec.ts` so that Playwright does not load it).

Good to know:

- A server you started yourself on port 3000 is reused, with whatever state it is in. If it is stale or unhealthy the warm-up stops with the page it failed on; stop the server, delete `.next`, and run again.
- The dev server keeps its generated files in `.next/dev`, apart from the production build's files in `.next` (observed on Next 16.4.3: a browser run straight after `npm run build` behaved the same as one without it).
