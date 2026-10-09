# Operations/CRM v1: production launch runbook

Everything needed to take the private Operations application (inquiries, meeting
preparation, ownership, follow-ups, review) from the reviewed Preview to
production. **Nothing here has been done.** Each step needs the owner's go-ahead,
and the order matters. The rehearsal of the database steps is automated
(`tests/db/production-upgrade.test.mjs`): the exact production chain, realistic
inquiries, both migrations, both recovery scripts.

Related: `docs/admin-application.md` (how it works), `docs/admin-review-preview.md`
(the synthetic review Preview), `docs/security-baseline.md`, `docs/crm-roadmap.md`.

## What goes live, and what does not

| | |
| --- | --- |
| Goes live | Operations app (Vercel project 2, admin build) on its own hostname; two database migrations; two Supabase Auth accounts |
| Does not change | Public site, inquiry form, emails, Cal.com booking/recovery, booking migrations, the public Vercel project's settings and variables |
| Stays off | Automated preparation (`PREPARATION_GENERATOR` unset). Preparation is manual: copy the brief into a Claude chat, paste the result back |
| Never | `supabase/local-demo/*`, `supabase/review/*`, the deferred booking-ledger migration, "apply all pending migrations" |

## 1. The migrations (exactly two)

Production already has these, in this order:

1. `20260815000000_create_project_inquiries.sql`
2. `20260822000000_align_constraints_and_add_submission_token.sql`
3. `20260823000000_revoke_public_inquiry_privileges.sql`
4. `20260823120000_allow_disabled_notification_status.sql`
5. `20260824000000_add_cal_booking_event_ordering.sql`
6. `20261004000000_allow_not_sure_project_type.sql`
7. `20261007000000_allow_rebooking_after_cancellation.sql`

The launch adds, in this order, applied one file at a time:

8. `20261005000000_add_inquiry_preparation.sql`
9. `20261006000000_add_preparation_dashboard.sql`

Their timestamps sort *before* the already-applied `20261007...`, so **never use
`supabase db push` or any "apply pending" command**: apply each file by hand in
the SQL editor, in the order above. (A test fails if `supabase/migrations/`
gains or loses a file without this list being updated.)

What they do, all additive:

- **8** creates `inquiry_preparations`, `preparation_drafts`, `generation_usage`,
  `automation_control`, the worker functions, and one `after insert` trigger on
  `project_inquiries` that queues a job in the same transaction as the inquiry.
  Every existing inquiry is backfilled with one job marked `manual`, never queued
  for automation. All privileges: `service_role` only; row-level security on.
- **9** adds one column `owners` (empty by default) and a shape check to
  `project_inquiries`; creates `inquiry_follow_ups` and `inquiry_notes`; widens the
  draft review states; creates the `dashboard_*` functions (`service_role` only).

They change no existing row, column value, booking function, email setting or
public permission. The inquiry form's insert and the Cal.com booking functions are
unchanged; a test proves they still work after the migrations and after recovery.

**The one coupling to know:** after file 8, saving an inquiry also inserts its
preparation job (the same transaction; the trigger runs as the form's own
`service_role`). That is deliberate (no inquiry can be saved without its job) and is
covered by tests, but it means this migration is the one part of the launch that
touches the public intake path. Step 5 therefore includes a real test submission,
and recovery script 1 removes the trigger in one statement.

## 2. Before touching anything

- [ ] Omar has approved this launch in writing.
- [ ] The exact sign-in emails of the two team accounts are known (they are not guessed).
- [ ] Neither teammate has an unsaved draft anywhere (the Preview is synthetic; nothing carries over).
- [ ] The public site and its inquiry form are healthy (Step 3 of "Pre-checks").
- [ ] A quiet moment: no one is mid-submission (the migrations take well under a second).

## 3. Backup (the Free plan has no automatic backups)

Take a full copy of the `public` schema and keep it **outside the repository**, in the
password manager's encrypted storage or an encrypted drive. It contains client data.

```
pg_dump "<direct connection string from Supabase > Project Settings > Database>" \
  --no-owner --no-privileges --schema=public -f mintapp-before-crm-YYYY-MM-DD.sql
```

Check it: open the file, find the `project_inquiries` data, and confirm the row count
equals `select count(*) from public.project_inquiries;`. Also export
`project_inquiries` as CSV from the Table Editor as a second, human-readable copy.
If `pg_dump` is not available, the CSV export plus the SQL editor results below are
the minimum; do not continue without at least one verified copy.

## 4. Pre-checks (read-only; paste into the production SQL editor)

```sql
-- A. The CRM is not there yet. Expect: 0, 0, true, 0 rows.
select count(*) as dashboard_functions
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and (p.proname like 'dashboard\_%' or p.proname like '%preparation%');
select count(*) as crm_tables from information_schema.tables
 where table_schema = 'public' and table_name in ('inquiry_preparations','preparation_drafts','generation_usage','automation_control','inquiry_follow_ups','inquiry_notes');
select to_regclass('public.inquiry_preparations') is null as crm_absent;
select column_name from information_schema.columns where table_schema = 'public' and table_name = 'project_inquiries' and column_name = 'owners';

-- B. The seven earlier migrations are in effect. Expect: true, true.
select pg_get_constraintdef(oid) like '%not_sure%' as not_sure_allowed from pg_constraint where conname = 'project_type_values';
select pg_get_functiondef('public.apply_booking_created(uuid,text,timestamp with time zone,text,timestamp with time zone)'::regprocedure) like '%cancelled%' as rebooking_allowed;

-- C. Record these four values (write them down):
select count(*) as inquiries, count(*) filter (where deleted_at is not null) as soft_deleted from public.project_inquiries;
select md5(coalesce(string_agg(t::text, '|' order by t.id), '')) as fingerprint_before_file_8 from public.project_inquiries t;
select md5(coalesce(string_agg((to_jsonb(t) - 'owners')::text, '|' order by t.id), '')) as fingerprint_before_file_9 from public.project_inquiries t;
```

Stop if A or B differ from the expectation: something is not as documented.

Also confirm in a browser that `https://www.mintapp.tech/en` and `/ar` answer and the
form loads (do not submit).

## 5. Apply the two migrations, one file at a time

Open each file **in VS Code**, select all, copy, paste into the SQL editor, run. Do not
pipe SQL through the Windows clipboard tool or a Command Prompt pipe (it corrupts
non-ASCII text; see `docs/admin-review-preview.md`). Both files are ASCII-only.

1. Run `20261005000000_add_inquiry_preparation.sql`. Expect "Success. No rows returned".
   Run the **post-checks for file 8** below before continuing.
2. Run `20261006000000_add_preparation_dashboard.sql`. Expect the same.
   Run the **post-checks for file 9**.

### Post-checks for file 8 (read-only)

```sql
-- One job per inquiry, all manual, none queued. Expect: true, then one row: manual | <N>.
select (select count(*) from public.inquiry_preparations) = (select count(*) from public.project_inquiries) as one_job_each;
select status, count(*) from public.inquiry_preparations group by status;
-- The trigger exists exactly once. Expect: 1.
select count(*) from pg_trigger where tgname = 'project_inquiries_queue_preparation' and not tgisinternal;
-- Existing inquiries are untouched. Expect: equals fingerprint_before_file_8 from Step 4.
select md5(coalesce(string_agg(t::text, '|' order by t.id), '')) from public.project_inquiries t;
```

### Post-checks for file 9 (read-only)

```sql
-- Existing inquiries untouched (the new "owners" column is excluded from the comparison). Expect: equals fingerprint_before_file_9 from Step 4.
select md5(coalesce(string_agg((to_jsonb(t) - 'owners')::text, '|' order by t.id), '')) from public.project_inquiries t;
-- Nobody owns anything yet; nothing else was created. Expect: 0, 0, 0, 0.
select count(*) from public.project_inquiries where owners <> '{}';
select (select count(*) from public.inquiry_follow_ups) + (select count(*) from public.inquiry_notes) + (select count(*) from public.preparation_drafts) + (select count(*) from public.generation_usage);

-- The public database roles can reach none of it. Expect: every value false / 0 rows.
select r.rolname, t.tbl, has_table_privilege(r.rolname, 'public.' || t.tbl, 'select') as can_read
  from (values ('anon'), ('authenticated')) as r(rolname)
  cross join (values ('project_inquiries'),('inquiry_preparations'),('preparation_drafts'),('inquiry_follow_ups'),('inquiry_notes'),('generation_usage'),('automation_control')) as t(tbl)
 where has_table_privilege(r.rolname, 'public.' || t.tbl, 'select');
select routine_name, grantee from information_schema.routine_privileges
 where routine_schema = 'public' and grantee in ('PUBLIC','anon','authenticated')
   and (routine_name like 'dashboard\_%' or routine_name like '%preparation%' or routine_name in ('monthly_generation_tokens','record_generation_usage'));
-- Row-level security is on for all six tables. Expect 6 rows, all true.
select relname, relrowsecurity from pg_class where relname in ('inquiry_preparations','preparation_drafts','generation_usage','automation_control','inquiry_follow_ups','inquiry_notes');
```

If any check fails, **stop and run recovery script 2 (Section 11, tier C)**, then report.

## 6. Test the public intake once (the trigger is on the form's path)

With the migrations applied and **before** anything else changes, Omar submits one
clearly marked inquiry through the live form (English or Arabic; the Cloudflare check is
done by a person), using only the team's own test address, with "MINTAPP TEST" as the
company. Expect: the success panel, the internal notification, the acknowledgment
email, and in the SQL editor:

```sql
select i.id, i.notification_status, i.booking_status, p.status as preparation_status
  from public.project_inquiries i left join public.inquiry_preparations p on p.inquiry_id = i.id
 where i.company_name = 'MINTAPP TEST' order by i.created_at desc limit 1;
-- Expect: notification_status sent, preparation_status queued.
```

If the form fails, run recovery script 1 immediately (it removes the trigger; the form
is then exactly as before). Leave the test inquiry in place, identifiable by its
company. (It cannot be deleted with one statement: delete its row in
`inquiry_preparations` first, then the inquiry.)

## 7. Accounts (Supabase Auth, production project)

The two team accounts are created only after the exact emails are supplied.

1. Authentication > Sign In / Providers > Email: **turn off "Allow new users to sign up"**;
   keep "Confirm email" on. Multi-factor: authenticator app (TOTP) enabled.
2. Authentication > Users > Add user, for each of the two emails, with a strong
   generated password kept in the password manager (share the second person's through it).
3. Confirm no other users exist.

Each person signs in once, sets up the authenticator app immediately, and checks that a
second sign-in asks for a code.

## 8. The Operations Vercel project

A second project from the same repository (Hobby plan is enough). Do not touch the
public project.

| Setting | Value |
| --- | --- |
| Production branch | `main` (only after the admin work is merged, Section 9) |
| Environment variables (Production only) | `APP_SURFACE=admin`, `ADMIN_HOSTS`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `ADMIN_TEAM`, `ADMIN_SESSION_SECRET` (see `docs/admin-application.md`) |
| Must be unset | `PREPARATION_GENERATOR`, `CODECRAFT_*`, `PREPARATION_WORKER_SECRET`, `TEAM_ACCOUNTS`, `DASHBOARD_SESSION_SECRET`, `ADMIN_AUTH`, `DASHBOARD_DEMO`, `EMAIL_SENDING_MODE` |
| Deployment Protection | On for Previews |
| Domain | none until Section 10 |

`ADMIN_TEAM` holds the two real emails and the ids `omar` and `adam` (ids are what
ownership stores). With no `ADMIN_HOSTS` the deployment answers nowhere.

## 9. Merge the admin work to `main` (separate approval)

Only after Sections 4 to 6 pass. `review/admin-preview` already contains `main` (merged
with an ordinary merge) so this is a fast-forward or a merge commit, never a rebase or
force-push. Merging triggers a production deploy of the **public** project: the public
build contains no admin routes and its browser bundle is unchanged in size (verified;
see the review report). After it deploys, run the public smoke checks:
`/en`, `/ar`, `/en/start`, `/en/book` respond; the sitemap has 24 URLs and no `/book`,
`/login` or `/inquiries`; `/login` and `/inquiries` return 404.

## 10. Hostname and first sign-in

The recommended hostname is `ops.mintapp.tech`. Set `ADMIN_HOSTS=ops.mintapp.tech` in the
Operations project **before** attaching the domain, then add the domain and the DNS
record Vercel shows. Then:

- [ ] `https://ops.mintapp.tech/login` loads; `/en`, `/api/inquiries`, `/sitemap.xml` return 404 there.
- [ ] The same project's `*.vercel.app` address returns 404 (not an approved host).
- [ ] Response headers: `Cache-Control: private, no-store`, `X-Robots-Tag: noindex, nofollow`, `X-Frame-Options: DENY`, a CSP with `frame-ancestors 'none'`.
- [ ] Each person signs in, sets up the authenticator, and sees the inquiry list (the existing inquiries, with "Manual" preparation).
- [ ] The password alone opens nothing; a wrong password and a non-team account get the same message.
- [ ] Sign out; the back button and a copied cookie do not reopen the session.
- [ ] Switch to Arabic: right-to-left, no overflow on a phone.
- [ ] Omar opens an inquiry, copies the brief (no contact details in it), pastes a result, marks it ready; Adam approves; the author cannot.

## 11. Rollback plan (cheapest first)

| Tier | When | Action | Data effect |
| --- | --- | --- | --- |
| A. Hide the app | Anything wrong with the Operations app | Remove the domain from the Operations project, or clear `ADMIN_HOSTS` and redeploy (it then answers nowhere). In Supabase, disable the two users | None. The public site never depended on it |
| B. Public code | The public site misbehaves after the merge | Vercel public project > Deployments > the deployment of `4af3296` (id `6885155187`, `mintapp-website-51e5dxo3w`) > **Instant Rollback** | None; the migrations are additive and stay |
| C. Stop new jobs | The inquiry form misbehaves after file 8 | Run `supabase/rollback/01_stop_new_preparation_jobs.sql` (one statement: drops the trigger) | None. Inquiries save exactly as before; the dashboard offers manual preparation for inquiries with no job. Re-apply file 8 to turn it back on (its backfill gives any inquiry saved meanwhile a manual job) |
| D. Remove the CRM | The CRM must come out entirely | **First export the team's data** (below), then run `supabase/rollback/02_remove_operations_crm_v1.sql` (one transaction) | Deletes the team's notes, drafts, follow-ups and owners. Inquiries, bookings and every public function are untouched; the schema returns to exactly its pre-launch state (tested by comparing fingerprints) |

Export before tier D (run each, save the results outside the repository):

```sql
select * from public.preparation_drafts order by inquiry_id, version;
select * from public.inquiry_follow_ups order by inquiry_id, due_on;
select * from public.inquiry_notes order by inquiry_id, created_at;
select id, owners from public.project_inquiries where owners <> '{}';
```

The recovery scripts live in `supabase/rollback/`, outside `supabase/migrations/`, and
say on their first line that they are recovery only (a test enforces both).

## 12. After launch

- [ ] Add a record of this launch to `docs/deployments.md` (what shipped, commit, deployment ids; no keys, URLs of projects, or personal data).
- [ ] Check Dependabot and `npm audit --omit=dev` stay clean.
- [ ] The list is unbounded by design in v1 (about 190 ms and 3 MB at 5,000 inquiries; measured on a throwaway database). Add filters and paging before roughly 2,000 inquiries.
- [ ] Decide separately, and only with explicit approval, whether to ever enable automated preparation. It stays off.
