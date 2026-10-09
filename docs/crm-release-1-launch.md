# CRM Release 1: production launch runbook

Everything needed to take the private admin application from the reviewed Preview
to production. **Nothing here has been done.** The CRM is on the feature branch
`feat/crm-release-1`; it has not been merged, deployed, or applied to any
production system. Each step needs the owner's go-ahead, and the order matters.
The database steps are rehearsed by `tests/db/production-upgrade.test.mjs`: the exact
production chain, realistic inquiries, every migration below, and both recovery scripts.
The SQL blocks in section 4 are run by that test, so this document cannot drift from the database.

Related: [crm-release-1.md](crm-release-1.md) (what it is), [admin-application.md](admin-application.md),
[security-baseline.md](security-baseline.md), and the earlier [operations-crm-v1-launch.md](operations-crm-v1-launch.md),
whose Operations v1 steps (files 8 and 9) this runbook includes.

## 1. What goes live, and what does not

| | |
| --- | --- |
| Goes live | The admin application (a second Vercel project, `APP_SURFACE=admin`) on a hostname the owner chooses; seven database migrations; two Supabase Auth accounts |
| Does not change | The public site, the inquiry form's behaviour, emails, Cal.com (event, notice, buffers, webhook, organizer), the booking migrations, the public Vercel project's settings and variables, DNS (until the hostname step) |
| Stays off | Automated preparation: `PREPARATION_GENERATOR` unset. No CodeCraft key, no real client data to any generator |
| Never | `supabase/review/*`, `tests/fixtures/*`, the deferred booking-ledger migration, "apply all pending migrations" |

The public site changes in one small way: the form keeps `utm_content`. It is sent
only when the visitor arrived by a tracked link, and the public insert falls back to
storing the inquiry without it if the column does not exist yet, so the order of
release cannot lose an inquiry. Apply migration 11 before relying on it.

## 2. The migrations (exactly seven)

Production already has, in order:

1. `20260815000000_create_project_inquiries.sql`
2. `20260822000000_align_constraints_and_add_submission_token.sql`
3. `20260823000000_revoke_public_inquiry_privileges.sql`
4. `20260823120000_allow_disabled_notification_status.sql`
5. `20260824000000_add_cal_booking_event_ordering.sql`
6. `20261004000000_allow_not_sure_project_type.sql`
7. `20261007000000_allow_rebooking_after_cancellation.sql`

This release adds, in this order, **one file at a time** (the first two sort before the
already-applied `20261007...`, so `supabase db push` and any "apply pending" command are forbidden):

8. `20261005000000_add_inquiry_preparation.sql`
9. `20261006000000_add_preparation_dashboard.sql`
10. `20261010000000_add_admin_auth_throttle.sql`
11. `20261011000000_add_crm_core.sql`
12. `20261012000000_add_crm_proposals_projects.sql`
13. `20261013000000_add_crm_outreach.sql`
14. `20261014000000_add_crm_reads.sql`

All are additive and safe to run twice. Their effect on existing data: an added trigger
(a preparation job per new inquiry; existing inquiries get a `manual` job so nothing is
ever sent to automation), one nullable column (`utm_content`), the owners column, and
the widening of the sales-stage list from six names to thirteen (`converted`, `not_a_fit`,
`archived` become `won`, `lost`, `paused`; in production every inquiry is `new`).

## 3. Before touching anything

- Get the owner's explicit go-ahead for each numbered step.
- Take a backup (the Free plan has none): follow section 3 of the earlier runbook
  (`operations-crm-v1-launch.md`), a full dump of `public` with the connection string
  kept out of any file or log.
- Confirm the working branch builds and its tests pass (section 8).
- Record the rollback reference: the production `main` commit and deployment that are live now.

## 4. Checks (read-only; paste into the production SQL editor)

### Pre-checks for Release 1 (run after Operations v1, files 8 and 9, are live)

```sql
select count(*) from information_schema.tables where table_schema = 'public' and (table_name like 'crm\_%' or table_name in ('inquiry_crm', 'admin_auth_throttle'));
select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'project_inquiries' and column_name = 'utm_content';
select coalesce(string_agg(lead_status || ':' || n, ',' order by lead_status), '') from (select lead_status, count(*) as n from public.project_inquiries group by lead_status) s;
select count(*) from public.inquiry_preparations;
```

Expected: `0`, `0`, the stage counts you recognise (all `new:` in production), and one preparation row per inquiry.

### Post-checks for Release 1 (after file 14)

```sql
select count(*) from public.admin_auth_throttle;
select count(*) from information_schema.tables where table_schema = 'public' and (table_name like 'crm\_%' or table_name = 'inquiry_crm');
select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'project_inquiries' and column_name = 'utm_content';
select coalesce(string_agg(lead_status || ':' || n, ',' order by lead_status), '') from (select lead_status, count(*) as n from public.project_inquiries group by lead_status) s;
select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
select count(*) from information_schema.role_table_grants where grantee in ('anon', 'authenticated') and table_schema = 'public' and (table_name like 'crm\_%' or table_name in ('inquiry_crm', 'admin_auth_throttle'));
select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and (p.proname like 'crm\_%' or p.proname like 'admin\_auth\_%') and has_function_privilege('anon', p.oid, 'execute');
```

Expected: `0` (throttle empty), `9` (CRM tables), `1` (the column), the same stage counts as before,
`0` (every public table has row-level security), `0` (no table grant to the public roles), `0`
(no CRM function the public roles can run).

## 5. Apply, one file at a time

In the Supabase SQL editor of the **production** project, only after sections 3 and 4:
files 8 and 9 (and their post-checks, as in the earlier runbook), then 10, 11, 12, 13, 14.
Run the Release 1 pre-checks before file 10 and the post-checks after file 14. If anything
differs from the expected values, stop and do not continue.

Test the public intake once afterwards (one real submission with a test address, no
real email sent: `EMAIL_SENDING_MODE` as it is in production today) and confirm the
inquiry and its preparation job exist.

## 6. Supabase Auth settings (production project; the app cannot check these)

- Public sign-ups disabled (Authentication, Providers, Email: "Allow new users to sign up" off).
- Email confirmation on; password minimum length 12 or more with letters, digits and symbols required.
- Multi-factor: TOTP enabled.
- Create exactly two users (Omar and Adam) by invitation; each enrols an authenticator on first sign-in.
- Rate limits left at the Supabase defaults or tighter (the app adds its own throttle).

## 7. Accounts, the Vercel project, the hostname

Follow sections 7 to 10 of the earlier runbook for the second Vercel project and the
hostname, with these variables on the admin project only (never on the public project):
`APP_SURFACE=admin`, `ADMIN_HOSTS`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`,
`SUPABASE_PUBLISHABLE_KEY`, `ADMIN_TEAM`, `ADMIN_SESSION_SECRET`. Leave `PREPARATION_GENERATOR`,
`CODECRAFT_*` and `PREPARATION_WORKER_SECRET` unset. **No hostname has been chosen.** Merging
`feat/crm-release-1` to `main` is a separate approval.

## 8. Verification before and after

- Local: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run test:db`,
  `npm run test:dashboard`, `npm run test:build`, `npm audit --omit=dev`, `git diff --check`.
- After launch, as Omar and as Adam: sign in with the authenticator, open the dashboard,
  an inquiry, change nothing, sign out; confirm `/` on the public hostname still serves the
  public site and `/dashboard` on it is a 404.

## 9. Review Preview (no production)

A Preview of the admin project may only be pointed at the **synthetic review project**
(`mintapp-review`). Apply files 8 to 14 there only after confirming
`select public.review_environment();` returns `synthetic-review` (the marker is
`tests/fixtures/review-marker.sql`, applied to that project only). A Preview connected to
any other database refuses to read or write anything.

## 10. Rollback plan (cheapest first)

1. **Close the app**: remove `ADMIN_HOSTS` from the admin project, or roll it back to the previous deployment. No data changes.
2. **Revert the public site** to the rollback reference from section 3. The `utm_content` fallback means an older or newer public site both work with either database state.
3. **Stop new preparation jobs**: `supabase/rollback/01_stop_new_preparation_jobs.sql`. Keeps all data.
4. **Remove Release 1**: `supabase/rollback/03_remove_crm_release_1.sql` (stages fold back onto the six early names; CRM data is deleted: export it first), only on the owner's go-ahead.
5. **Remove Operations v1 as well**: `supabase/rollback/02_remove_operations_crm_v1.sql`, after 03.

## 11. Still manual after all of this

A native Arabic read of the new interface text; the outreach pool (the 30 accounts) is
entered by the team close to each contact date, not frozen weeks ahead; the loss reasons
and fit tiers are the starting lists and can change with a new migration.
