# Admin review Preview (synthetic data only)

How Omar and Adam review a working admin application without any connection
to real client records, using the existing Vercel project (Hobby plan, no new
Vercel project, no domain) and one isolated Supabase project.

## Isolation, by design

- **Database:** a separate Supabase project, `mintapp-review`, holding only
  the synthetic inquiries in `supabase/review/02_synthetic_inquiries.sql`.
- **Guard:** on a Preview of the admin application, every dashboard read and
  write first asks the database `public.review_environment()`; only the
  review project answers `synthetic-review`
  (`supabase/review/01_review_marker.sql`). A Preview misconfigured to point
  at the live database shows and changes nothing.
- **Sign-in:** Supabase Auth in that same review project, required
  authenticator app, allowlist of two synthetic review accounts. No real
  Omar or Adam accounts are created.
- **Branch-scoped settings:** the admin build and the review project's keys
  apply only to the `review/admin-preview` branch, so the public site's
  Previews and Production are untouched.

## Step 1. Create the review Supabase project (owner)

Supabase → New project, name `mintapp-review`, any region, a strong database
password kept in your password manager. It costs nothing only while your
organization has fewer than 2 active Free projects; free projects pause after
a week without activity (unpause from the dashboard).

Authentication settings:
- Sign In / Providers → Email: **turn off "Allow new users to sign up"**;
  keep "Confirm email" on.
- Multi-Factor: authenticator app (TOTP) enabled (the default).

## Step 2. Database: exact files, in this order (review project only)

Run each file's contents in the review project's SQL editor, one at a time:

1. `supabase/migrations/20260815000000_create_project_inquiries.sql`
2. `supabase/migrations/20260822000000_align_constraints_and_add_submission_token.sql`
3. `supabase/migrations/20260823000000_revoke_public_inquiry_privileges.sql`
4. `supabase/migrations/20260823120000_allow_disabled_notification_status.sql`
5. `supabase/migrations/20260824000000_add_cal_booking_event_ordering.sql`
6. `supabase/migrations/20261005000000_add_inquiry_preparation.sql`
7. `supabase/migrations/20261006000000_add_preparation_dashboard.sql`
8. `supabase/review/01_review_marker.sql`
9. `supabase/review/02_synthetic_inquiries.sql`

Never run: `20261001000000_add_cal_booking_event_ledger.sql` (deferred, only on
`feat/pending-booking-workflow`), anything in `supabase/local-demo/`, and
never "apply all pending migrations". Nothing here touches the live project.

Check: `select public.review_environment();` returns `synthetic-review`, and
`select count(*) from public.project_inquiries;` returns 4.

## Step 3. Test sign-in against real Supabase Auth (local, synthetic)

Create `.env.review.local` in the repository (ignored by Git) with the review
project's values from Settings → API Keys:

```
REVIEW_SUPABASE_URL=https://<review-project-ref>.supabase.co
REVIEW_SUPABASE_PUBLISHABLE_KEY=<publishable (anon) key>
REVIEW_SUPABASE_SECRET_KEY=<secret (service_role) key>
```

Then `npm run test:admin-auth-live`. It refuses to run unless the project
answers the review marker, recreates three synthetic test accounts
(`omar.review@`, `adam.review@`, `outsider.review@example.com`) with a random
password, and runs the sign-in suite against real Supabase Auth: password
sign-in, authenticator setup and codes, the allowlist, refusals, sign-out
revocation, sign out everywhere and the idle limit. Data stays local.

## Step 4. Reviewer accounts (owner)

In the review project → Authentication → Users → Add user, create two users
with **Auto Confirm**:
`omar.preview@example.com` and `adam.preview@example.com`, with passwords you
choose (16+ characters, kept in your password manager; share Adam's through
it). Each person sets up their authenticator at first sign-in.

## Step 5. The Preview in the existing Vercel project (owner)

Vercel → mintapp-website → Settings → Environment Variables → add each with
environment **Preview** and branch **`review/admin-preview`** only:

| Name | Value |
| --- | --- |
| `APP_SURFACE` | `admin` |
| `SUPABASE_URL` | review project URL |
| `SUPABASE_PUBLISHABLE_KEY` | review publishable key |
| `SUPABASE_SECRET_KEY` | review secret key |
| `ADMIN_TEAM` | `[{"id":"omar","email":"omar.preview@example.com","name":"Omar"},{"id":"adam","email":"adam.preview@example.com","name":"Adam"}]` |
| `ADMIN_SESSION_SECRET` | 32+ random characters |
| `PREPARATION_GENERATOR` | `off` |
| `EMAIL_SENDING_MODE` | `disabled` |

Then push the branch: `git push origin feat/inquiry-preparation:review/admin-preview`.

The Preview's address is the branch address, for example
`https://mintapp-website-git-review-admin-preview-omarmeneams-projects.vercel.app`
(Vercel shows the exact one on the deployment). Open `/login`.

## Step 6. Access for Omar and Adam

Vercel Authentication protects Previews; on the Hobby plan only the account
owner can pass it. To let Adam in, Omar opens the deployment in Vercel →
**Share** and sends Adam the shareable link. The admin application's own
sign-in, authenticator code and allowlist still apply behind it.

## What to review

Sign in, set up the authenticator, open the list and an inquiry, copy the
brief, paste a draft, mark it ready and approve it as the other person, set
owners (Omar, Adam, Omar & Adam), add a follow-up with a person and a due
date, mark it done, add a note, switch to Arabic, sign out.
