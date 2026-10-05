# Security baseline

Part 1 is the baseline Mintapp applies to its own products and adapts for
client projects. Part 2 is Mintapp's own status against it, checked against
the code, tests and live responses on 5 October 2026 (branch
`feat/inquiry-preparation`; the live site runs `main`). A control counts as
**in place** only with the evidence named next to it.

## Part 1: Baseline

| Control | What it means | How to verify |
| --- | --- | --- |
| Secrets stay out of Git | `.env*` ignored (only a blank `.env.example` tracked); secrets only in the host's encrypted settings; server-only modules never imported by client code | `git ls-files`, a history scan for key patterns, a search of built browser bundles for secret names |
| Strong password handling | Never store passwords; use a maintained auth service, or a slow salted hash (scrypt/Argon2/bcrypt) with a unique salt per password; MFA for staff | Read the hash format and parameters; tests that two hashes of one password differ |
| HTTPS everywhere | HTTPS only, HSTS, `Secure` cookies (prefer `__Host-`) | Response headers; cookie attributes in tests |
| Server-side input validation | Every input validated on the server with an explicit schema, size and type limits; never trust client checks | Tests posting invalid, oversized and wrong-type input |
| Output encoding | Framework escaping only (no raw HTML from data); plain-text email; no user data in headers | Search for raw-HTML sinks; review email and header construction |
| CAPTCHA on exposed forms | Token verified on the server (hostname and action checked), failing closed | Tests for missing, invalid and unverifiable tokens |
| Narrow CORS | No CORS unless a named origin needs it; never `*` with credentials | Search for CORS headers; check API responses |
| Parameterized queries | Database access through parameterized APIs or typed functions; no SQL built from user input | Search for string-built SQL; database tests |
| Validate generated output | AI or other generated content is checked before use and reviewed by a person | Tests for rejected output; the review step in the product |
| Security headers | CSP, frame protection, `nosniff`, referrer and permissions policies | Response headers on real pages, and a browser check for CSP violations |
| Login rate limiting | Limits per account and per client; a lockout that can't be used to lock out a teammate | Tests that hit the limit; the auth provider's settings |
| Dependency maintenance | Automated update PRs, audit of production dependencies, prompt patching | `npm audit --omit=dev`; Dependabot or equivalent |
| Safe errors, internal logs | Users see a generic message (and a reference); details and codes go to server logs, never secrets or personal data | Tests for error responses; review log lines |

## Part 2: Mintapp status (verified 5 October 2026)

### In place

- **Secrets:** `.env*` is ignored; only `.env.example` is tracked. A scan of the full Git history (all branches) for key patterns found none. Production builds contain no secret variable names in browser bundles (checked on both builds).
- **Passwords:** the public site has no accounts. Admin sign-in uses Supabase Auth (passwords stored by Supabase) with a required authenticator app. The local demo login uses scrypt (N=32768, r=8, p=1), a 16-byte random salt per hash, constant-time comparison (`src/lib/team-auth/team-auth.test.ts`).
- **HTTPS:** Vercel serves HTTPS; the live site sends `strict-transport-security: max-age=63072000`. Admin cookies are `__Host-`, `Secure`, `HttpOnly`, `SameSite=Strict` (end-to-end tests).
- **Input validation:** the inquiry API checks content type, size, schema (zod), timing and Turnstile before saving; the Cal.com webhook verifies an HMAC-SHA256 signature in constant time, then validates the payload; admin actions validate every field and accept only known team member ids.
- **Output encoding:** React escaping throughout; no `dangerouslySetInnerHTML`; the notification email is plain text with a fixed subject; drafts are rendered as text.
- **CAPTCHA:** Cloudflare Turnstile verified server-side with hostname and action checks; returns 503 (no save) when verification is unavailable.
- **CORS:** none configured, so browsers allow only same-origin reads; Next.js server actions reject cross-origin calls; the admin CSP allows `form-action 'self'` only.
- **Parameterized queries:** Supabase client and RPC calls are parameterized; database functions take typed parameters; the local demo passes data only inside a dollar-quoted JSON literal with a random tag. Dynamic SQL exists only in grant loops over constant names.
- **Generated output:** automated drafts must quote the brief for every client fact, may not use figures the client never stated, and must be in the right language; every draft is reviewed and approved by a person.
- **Database access:** row-level security on every table with no policies; tables and functions granted to `service_role` only (database tests for `anon` and `authenticated`).
- **Admin headers:** CSP (`default-src 'self'`, no external hosts), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `noindex`, `no-store`. The production build was checked in a browser: sign-in and authenticator setup work with no CSP violations.
- **Safe errors:** APIs return generic messages with a code; server logs carry codes, not personal data; the admin error page shows only an opaque reference.
- **Dependencies:** `npm audit --omit=dev` reports 0 vulnerabilities.

### Gaps (actual)

| Gap | Risk | Fix | Status |
| --- | --- | --- | --- |
| Public site sends no CSP, frame, `nosniff`, referrer or permissions headers | Clickjacking of the Start Project form; weaker defence if an injection bug ever appears | Add headers in `next.config.ts`; start the CSP as Report-Only, allowing Turnstile (`challenges.cloudflare.com`) and the Cal.com embed (`app.cal.com`, `cal.com`), then enforce | Proposed; it changes the live site, so it ships as its own reviewed change |
| No per-client rate limit on the inquiry API | Turnstile, timing checks and duplicate tokens stop most abuse, but nothing caps volume per address | A Vercel Firewall rule on `/api/inquiries` (check what the Hobby plan allows), or an app-level limit table | Proposed |
| Admin sign-in rate limits come only from Supabase Auth | Untested against real Supabase | Confirm the project's Auth rate limits, then run `npm run test:admin-auth-live` | Waiting for the review project |
| 7 high advisories in dev tooling (eslint's dependencies) | Development machines only; nothing shipped | Update `eslint-config-next` when a fixed version is out | Dependabot added (`.github/dependabot.yml`), effective once on `main` |
| Runtime logs are kept 1 hour on the Hobby plan | Errors are easy to miss | Rely on recorded states (for example `notification_status` on each inquiry) and check them after any live test | Accepted for now |
| No automated test run on push | A regression could reach `main` unnoticed | A GitHub Actions workflow running lint, typecheck and unit tests (check free minutes first) | Proposed |
