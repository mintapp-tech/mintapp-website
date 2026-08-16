# Supabase Database Permissions — Reference

Non-secret technical reference for how the Mintapp website talks to its Supabase project. No project URL, API key, password, or connection string appears anywhere in this file, and none should ever be added to it.

This document explains **why** the database is configured the way it is. It does not by itself recreate the database — see [`supabase/migrations/`](../supabase/migrations/) for the reproducible schema. This file and the migration are companions: the migration is the source of truth for structure, this file is the source of truth for the reasoning and the operational rules around it.

## Architecture

```
Browser  →  Next.js server-side API route  →  Supabase Data API (PostgREST)  →  Postgres
```

- The website never opens a direct Postgres connection and never uses a Postgres connection string. All database access goes through Supabase's Data API, via the `@supabase/supabase-js` client library, called only from server-side code (Next.js Route Handlers / server actions).
- The browser talks only to Mintapp's own Next.js server. It never talks to Supabase directly.

## Required environment variables

| Name | Where it's used | Notes |
|---|---|---|
| `SUPABASE_URL` | Server only | The project's Data API base URL. |
| `SUPABASE_SECRET_KEY` | Server only | New-format Supabase secret key (`sb_secret_...`). Bypasses Row-Level Security — see below. |

Rules that must never be violated:
- Neither variable is prefixed with `NEXT_PUBLIC_`.
- Neither variable is read from, or passed to, any client (browser) component.
- No anon/publishable key is currently in use by this project. If one is introduced later for genuine browser-side reads, it must be a separate, distinctly-named variable — never the secret key.

Real values live only in `.env.local` (git-ignored) and the team password manager. Nothing here is a placeholder for the real value; the real value is never written to this repository.

## Row-Level Security

- RLS is **enabled** on `project_inquiries`.
- **Zero policies** are defined on the table.
- Enabled RLS with no policies means "deny by default": the `anon` and `authenticated` Postgres roles — i.e. any request using a browser-safe/publishable key, or a logged-in Supabase Auth user — have **no usable access** to this table at all, regardless of what table-level grants exist, because RLS blocks them before a grant is even consulted.

## The `service_role` bypass, and why it's still scoped down

The Supabase secret key authenticates as the `service_role` Postgres role. `service_role` **bypasses RLS entirely** by design — that's what makes it correct for a trusted server to use, and also exactly why it must never reach a browser.

Bypassing RLS is not the same as having unlimited privileges. Table-level `GRANT`s are a separate, more fundamental layer underneath RLS: a role needs an applicable grant *and* to pass (or bypass) RLS to do anything. `service_role` bypasses RLS but still only has the specific table-level grants explicitly given to it.

## Why grants had to be applied manually, and the `42501` issue

This project's Supabase setting **"Automatically expose new tables"** was left **disabled**. That setting, when off, blocks PostgREST's default grants for *every* Data API role — not just `anon`/`authenticated` as might be assumed. This was discovered directly during testing: `service_role` requests initially failed with:

```
{"code":"42501","message":"permission denied for table project_inquiries", ...}
```

`42501` is Postgres's standard permission-denied code — it means the grant layer rejected the request, independent of RLS. The fix was to grant the minimum necessary privileges to `service_role` explicitly (see below and the migration file).

## Exact `service_role` grants

```sql
GRANT SELECT, INSERT, UPDATE ON public.project_inquiries TO service_role;
```

**`DELETE` is deliberately not granted.** The server-side application has no legitimate reason to hard-delete an inquiry row — the schema uses a `deleted_at` soft-delete column instead (see the migration). Not granting `DELETE` means that even if the server-side code were ever compromised or contained a bug, it is structurally incapable of permanently erasing inquiry records — a genuine erasure request is handled as a deliberate, separate, auditable action (e.g. via the Supabase SQL editor by an authorized person), not as something the application itself can do.

`anon` and `authenticated` receive **no grants at all** on this table, on top of having no RLS policies — two independent layers both denying access, not one.

## `sb_secret_...` header behavior

New-format secret keys are **not** JWTs. They must be sent as:

```
apikey: sb_secret_...
```

**Never** as `Authorization: Bearer sb_secret_...` — that header is for JWT-based (legacy `anon`/`service_role` key or Supabase Auth user) authentication and will reject a new-format secret key with an invalid-key error that can be mistaken for a platform bug.

## Key rotation procedure

No actual key value appears below.

1. In the Supabase dashboard, generate a new secret key for the project.
2. Update `SUPABASE_SECRET_KEY` in the team password manager with the new value.
3. Update `SUPABASE_SECRET_KEY` in `.env.local` on every machine that runs the server locally.
4. Once real deployments exist, update the corresponding environment variable in the hosting platform's project settings (not yet applicable — nothing has been added to Vercel for this project as of this document).
5. Revoke/delete the old secret key in the Supabase dashboard.
6. Confirm the old key no longer authenticates (a request using it should fail), and confirm the new key does work, using the safe verification checklist below.
7. Treat any secret key that was ever pasted into a chat log, ticket, screenshot, or shared document as compromised — rotate it immediately, following steps 1–6, even if it appears to still work.

## Last verified

2026-08-15, against the live project, using the checklist below (results: schema and grants match this document; table currently contains 0 rows).

## Safe verification checklist

These checks are safe to re-run at any time: none of them can create, modify, or delete real data, and none of them print or require displaying the secret key's value (run them from a shell that reads the key from `.env.local` into a variable and uses that variable directly — never echo it).

1. **Schema/columns match** — `GET {SUPABASE_URL}/rest/v1/` with header `Accept: application/openapi+json` and the secret key in the `apikey` header. Confirm the `project_inquiries` definition matches the migration's column list.
2. **SELECT works, row count sanity check** — `GET {SUPABASE_URL}/rest/v1/project_inquiries?select=id&limit=1` with header `Prefer: count=exact`. Confirm `200` and read the row count from the `Content-Range` response header (e.g. `*/0`) — this avoids pulling any real applicant data into view.
3. **DELETE is still blocked** — `DELETE {SUPABASE_URL}/rest/v1/project_inquiries?id=eq.00000000-0000-0000-0000-000000000000` (an id that cannot exist, so nothing real is ever at risk even if the grant were somehow present). Expect `403` with code `42501`.
4. **`anon`/`authenticated` still have no access** — repeat check 2 using a publishable/anon key instead of the secret key, sent the same way. Expect `401`/`403`, never real data.

If any of these produce an unexpected result, stop and investigate before writing any application code that depends on this table.
