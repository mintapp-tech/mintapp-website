# Private admin application

The Mintapp team's private dashboard (first module: inquiries and meeting
preparation; later the internal CRM). It is a separate Vercel deployment built
from this repository, on a hostname the team chooses.

## Architecture

- **One codebase, two Vercel projects.** The public site builds as before. The
  admin project sets `APP_SURFACE=admin`. Admin route files are named
  `*.admin.tsx`, so they exist only in the admin build; the public build
  contains no admin pages (`next build` route list: no `/login`, `/inquiries`).
- **Admin routes:** `/login`, `/login/mfa`, `/inquiries`, `/inquiries/[id]`.
  `/` redirects to `/inquiries`. Every other path (public pages, `/api/*`)
  returns 404 on the admin deployment.
- **Hosts:** the admin deployment answers only on `ADMIN_HOSTS`. A Vercel
  Preview of the admin project also answers on its own generated hostnames;
  production answers nowhere until `ADMIN_HOSTS` is set. The hostname is
  configuration, never code.
- **Headers:** `X-Robots-Tag: noindex, nofollow`, `Cache-Control: private,
  no-store`, `X-Frame-Options: DENY`, `frame-ancestors 'none'`.
- **Data:** server-side only, through the service-role SQL gateway, as before.

## Sign-in

Supabase Auth, server-side only (`@supabase/ssr`; no browser Supabase client):

1. Email and password (`signInWithPassword`). Any account not in `ADMIN_TEAM`
   gets the same answer as a wrong password, and its session is ended at once.
2. A required authenticator-app code (TOTP). The first sign-in sets up the
   authenticator; with only the password (aal1) every private page and action
   redirects to `/login/mfa`.
3. Every page and every data-changing action checks, on the server: the auth
   server still accepts the session (signed-out or revoked sessions fail), the
   email is allowlisted, this session completed MFA (aal2), and activity is
   within 2 idle hours and 12 hours in total. Anything that cannot be checked
   counts as no access.

Supabase's own session time-box and inactivity timeout are Pro-plan features
and Supabase refresh tokens never expire by default, so the idle and absolute
limits are enforced by the application (a signed, host-only activity cookie
bound to the Supabase session id; an expired session is revoked on the auth
server). Cookies are `__Host-` prefixed, HttpOnly, Secure, SameSite=Strict and
last at most 12 hours. Sign-out revokes the session on the auth server;
"Sign out everywhere" revokes all of that person's sessions.

The custom team login in `src/lib/team-auth` exists only for the local
synthetic demo. `authMode()` refuses it in any production build.

## Environment (admin Vercel project only)

| Name | Purpose |
| --- | --- |
| `APP_SURFACE` | `admin` |
| `ADMIN_HOSTS` | chosen hostname(s), comma-separated |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | publishable (anon) key, for Supabase Auth |
| `SUPABASE_SECRET_KEY` | service key, for dashboard data (server only) |
| `ADMIN_TEAM` | `[{"email":"…","name":"Omar"},{"email":"…","name":"Adam"}]` |
| `ADMIN_SESSION_SECRET` | 32+ random characters |

Leave `PREPARATION_GENERATOR` unset (off). Never set `TEAM_ACCOUNTS`,
`DASHBOARD_SESSION_SECRET`, `ADMIN_AUTH` or `DASHBOARD_DEMO` on Vercel.

## Database migrations for the dashboard

Supabase Auth needs no migration. The dashboard needs exactly two migrations,
applied in this order, on top of the five already on `main`
(`20260815000000` … `20260824000000`, which the live site depends on):

1. `20261005000000_add_inquiry_preparation.sql`: preparation jobs, drafts,
   usage and automation control; an `after insert` trigger on
   `project_inquiries` that queues a job in the same transaction (tested
   through the live form's own insert path, as `service_role`); existing
   inquiries are backfilled as `manual`, never queued for automation.
2. `20261006000000_add_preparation_dashboard.sql`: owner and next action on
   `project_inquiries`, team notes, draft review states, and the
   `dashboard_*` functions. All functions are `service_role` only.

**Not for any remote database:** `supabase/local-demo/*` (the demo login's
throttling and sessions). A test fails if those objects appear in
`supabase/migrations/`.

**Deferred booking work:** `20261001000000_add_cal_booking_event_ledger.sql`
exists only on the unmerged branch `feat/pending-booking-workflow`. It is not
in this branch, and the dashboard migrations reference none of its objects.
Its timestamp sorts before the dashboard migrations, so:

- Apply the two dashboard migrations explicitly by file (SQL editor or
  `psql -f`), never with "apply all pending" (`supabase db push
  --include-all` would also apply an older, unapplied file).
- Before that booking branch is ever merged, give its migration a timestamp
  later than the last applied one.
- Check the list of applied migrations before and after applying.

Take a backup before applying (the Free plan has no automatic backups).

## Before launch

1. In Supabase: disable public sign-ups; keep email confirmation on; create the
   two team accounts (Omar, Adam) and confirm their emails; each person signs
   in once and sets up the authenticator immediately.
2. Create the admin Vercel project from this repository with the environment
   above; keep Vercel Deployment Protection on for Previews.
3. Apply the two migrations as described above.
4. Choose the hostname, set `ADMIN_HOSTS`, then attach the domain.
5. Run the admin suites against the first admin Preview (cookie attributes over
   real HTTPS, MFA, sign-out revocation), and confirm the public site's build
   still has no admin routes.
