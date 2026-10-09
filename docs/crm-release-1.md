# CRM Release 1

The private admin application's CRM, built on the `feat/crm-release-1` branch.
It reviews as a Preview against the synthetic review project only; production
stays closed until a person releases it (see [crm-release-1-launch.md](crm-release-1-launch.md)).

## One codebase, two surfaces

- The **public site** has no CRM pages. Admin route files are named `*.admin.tsx` /
  `*.admin.ts` and exist only when `APP_SURFACE=admin` (`next.config.ts`).
- The **admin application** is a separate Vercel project from the same repository.
  It answers only on `ADMIN_HOSTS` (nowhere in production until that is set) and
  is closed without Supabase Auth configuration. No hostname is chosen here.
- A Vercel Preview of the admin project may only talk to the synthetic review
  database: before any read or write it asks `public.review_environment()`, which
  exists only in that project, and refuses everything otherwise
  (`src/lib/admin/review-guard.ts`). The guard does nothing in production.

## What it does

| Area | Where | Notes |
| --- | --- | --- |
| Overview | `/dashboard` | new inquiries, meetings to prepare, upcoming meetings, overdue follow-ups, attention items, preparation failures, drafts awaiting a teammate, proposals awaiting action, owner workload, recent activity |
| Inquiries | `/inquiries`, `/inquiries/[id]` | filters by owner, stage, meeting, preparation, origin, campaign, attention, free text; detail in the required order |
| Pipeline | `/pipeline` | 13 stages: New, Reviewing, Meeting booked, Preparing, Meeting ready, Meeting completed, Qualified, Proposal / scope preparation, Proposal sent, Negotiation, Won, Lost, Paused |
| Companies and contacts | `/companies`, `/contacts/[id]` | several contacts per company; an inquiry needs neither; consent and do-not-contact; duplicate hints, never a merge |
| Proposals | inquiry page, `/proposals` | versioned scope records; teammate approval; "sent" is recorded by a person |
| Projects | `/projects` | minimal record created from a won inquiry; the inquiry keeps its history |
| Outreach | `/outreach` | the first 30 accounts: research, lead score, four touches, dated next action, hand-over to the inquiry |
| Metrics | `/metrics` | inquiries, bookings, meeting-ready rate, qualified, proposals sent, wins, losses, overdue, source attribution, loss reasons, outreach |
| Search | `/search`, header box | companies, contacts, inquiries, prospects; matches email and phone but never shows them |
| Export | POST `/export/[kind]` | CSV; formula-injection safe; recorded on the activity trail |

Four states stay separate on every inquiry: the **meeting** (`booking_status`), the
**preparation** job, the draft **review**, and the **sales stage** (`lead_status`).
Nothing moves the sales stage because a meeting was booked, moved or cancelled; a
person does it, and each change is recorded with who and why. Losing needs a
reason from a fixed list.

### How the campaign's CRM requirements are met

Section 13 of the campaign playbook, one by one:

- Contact and company records: `crm_companies`, `crm_contacts`.
- Lead source, campaign and content identifier: the form now keeps `utm_content`
  next to `utm_source`, `utm_medium`, `utm_campaign`; the team can override
  campaign and content on the inquiry.
- Warm, outbound, referral, partner, inbound: `inquiry_crm.lead_origin`, plus the
  referral or partner name.
- Fit tier and lead score: five tiers; seven categories scored 0 to 2 (total 0 to 14).
- Trigger and research note: on the inquiry and on the prospect.
- Omar / Adam ownership, next action and due date: owners on the inquiry; every
  follow-up has one responsible person and a date; the overview flags open leads
  with no owner or no next action.
- Outreach touch history: `crm_outreach_touches` (a sentence, never the message).
- Inquiry, preparation, review and booking status: unchanged and shown together.
- Proposal / scope status: `crm_proposals`.
- Won, lost, paused outcomes and loss reason: stages plus `loss_reason`.
- Consent and communication controls: consent status and do-not-contact on
  contacts and prospects; an outbound touch to a do-not-contact prospect is refused.
- Activity log and export: `crm_activity`; CSV export.
- Automation never sends cold outreach: there is no sending code in the CRM.

## Data model

Additive migrations, applied by file, in order (never "apply pending"):

| File | Adds |
| --- | --- |
| `20261010000000_add_admin_auth_throttle.sql` | sign-in throttle table and three functions |
| `20261011000000_add_crm_core.sql` | `utm_content`; 13 pipeline stages on `lead_status`; `crm_companies`, `crm_contacts`, `inquiry_crm`, `crm_stage_history`, `crm_activity`; triggers that write the trail for follow-ups, notes, draft reviews and bookings; company, contact, link, details, stage and owner functions; duplicate detection |
| `20261012000000_add_crm_proposals_projects.sql` | `crm_proposals`, `crm_projects` and their functions |
| `20261013000000_add_crm_outreach.sql` | `crm_prospects`, `crm_outreach_touches` and their functions |
| `20261014000000_add_crm_reads.sql` | reads for overview, lists, search, metrics, export; `preparation_redactions` |

These come after v1's `20261005` and `20261006` (preparation and dashboard). Every
table has row-level security on and no grant to `anon` or `authenticated`; every
function is `service_role` only. Existing inquiries are untouched except that the
three early stage names carry over (converted to won, not_a_fit to lost, archived
to paused); in production every inquiry is still `new`. The rehearsal
`tests/db/production-upgrade.test.mjs` builds the production chain, loads
realistic inquiries, applies everything and proves the result, then proves the
recovery scripts (`supabase/rollback/03_remove_crm_release_1.sql`, then `02`).

## Architecture

- Pages are server components; every page and every server action calls
  `requireAdmin()` first (a layout is not re-run for an action).
- The app reaches data only through `src/lib/sql-gateway.ts`, a whitelist of
  database functions called with the service role, server-side. The browser never
  holds a database credential.
- Writes carry the signed-in member's email as the actor. Owners and responsible
  people are member ids (`omar`, `adam`), never emails.
- Lists and search return names and ids. Email, phone and contact handle appear
  only on a contact's, company's or prospect's own page and in the contacts export.
- Forms are validated by zod before any database call, and again by the database
  constraints. Result messages come from a fixed list selected by a code in the
  address; nothing typed is ever put in a URL.

## Security controls

- Supabase Auth only; public sign-up disabled in the project; sign-in limited to
  the `ADMIN_TEAM` allowlist (Omar and Adam); strong password policy and the
  authenticator-app requirement are Supabase project settings, checked in the
  launch runbook; the app refuses any session that is not MFA-complete (aal2).
- 2 hours idle and 12 hours absolute limits, enforced by a signed activity cookie;
  host-only, `HttpOnly`, `Secure`, `SameSite=Strict` cookies; sign-out revokes the
  session on the auth server; "sign out everywhere" revokes all of them.
- Sign-in throttle in the database: 8 failures per account from one client or 30
  per account overall in 15 minutes lock that key for 15 minutes; authenticator
  codes are throttled separately. Keys are salted hashes. If the throttle cannot
  be read, sign-in is refused.
- Cross-site protection: server actions are checked by Next.js against the Host;
  the export route checks `Origin`, `Host` and `Sec-Fetch-Site` itself; cookies are
  `SameSite=Strict`.
- Headers on every admin response: strict CSP (self only), `X-Frame-Options: DENY`,
  HSTS in production, `Referrer-Policy: same-origin`, `Permissions-Policy`,
  `Cache-Control: private, no-store`, `X-Robots-Tag: noindex`.
- Search and filters are parameters, never SQL text; LIKE wildcards are escaped.
- CSV export neutralises cells beginning with `=`, `+`, `-`, `@`, tab or carriage return.
- Logs carry error codes and function names only: no names, emails, phones or briefs.
- The service role key is read only on the server; a build test scans the client
  bundles for every server-side secret.

## Automatic preparation and the manual fallback

Unchanged in behaviour from v1, and hardened:

- An inquiry and its preparation job are created in one transaction (a trigger);
  the inquiry succeeds even if the notification email, the booking or the generator
  fails. Preparation does not depend on a booking, and cancelling or rescheduling
  never deletes it. Booking, a move and a cancellation are written to the trail by a
  trigger that cannot block the webhook.
- Job states: queued, running, retry_scheduled, succeeded, failed, paused, manual;
  at most 3 attempts with increasing delays; quota, key, budget, unknown-model and
  permission failures pause automation; a crashed worker's lease expires; two
  workers never claim the same job; the worker endpoint needs
  `PREPARATION_WORKER_SECRET`.
- The generator is a replaceable interface; **off by default**. CodeCraft needs its
  key (server only), an exact model id queried from the API
  (`scripts/codecraft-models.mjs`), and `CODECRAFT_CLIENT_DATA_APPROVED=true` before
  it may see a real inquiry. The monthly token budget defaults to 600,000 and cannot
  exceed 1,000,000; it is checked before each request, stops short of paid credit,
  and usage is recorded as counts only.
- A generator receives only the sanitised brief: the project type, budget, timeline
  and country the client chose and their description with any email, link, domain,
  handle, phone number, and their own name, company, email, phone or website removed
  (`src/lib/preparation/scrub.ts`). Booking ids and tracking never reach it.
- Drafts must quote the client verbatim, separate assumptions, and are rejected if
  they invent prices, deadlines, metrics, capabilities or present assumptions as facts.
- Manual path ("Prepare manually"): a copyable prompt built from the same sanitised
  brief, a paste-back field, versioned drafts, ready for review, approval by the
  teammate who did not write it, a warning for figures the client never stated, and
  recovery after an API failure without deleting manual drafts.

Real client data is never sent to any generator by this release: nothing is
configured, and `CODECRAFT_CLIENT_DATA_APPROVED` is unset.

## Testing

`npm run test:db` (real PostgreSQL, 120+ tests including the production-upgrade
rehearsal), `npm test` (unit), `npm run test:dashboard` (browser: both interface
languages, phone and desktop widths, accessibility scans, forged requests, the
sign-in flow), `npm run test:build` (both production builds, route and secret
scans). No test reaches the network or sends mail.

## Build notes

- A public `next build` (Turbopack, the default) once failed on one Windows machine with
  `next/font/google queries have exactly one entry` for Manrope, on `main` as well as this
  branch. The cause was the machine's stale `.next` directory, not the code, the network or
  Vercel: deleting `.next` (or building into another `distDir`) made the identical code
  compile, a warm second build and a webpack build over it stayed fine, and a build with the
  network blocked fails with a different, explicit message. If it appears again, delete `.next`
  and `.next-admin` and rebuild. `npm run test:build` starts from clean directories.

## Still to do by hand

See [crm-release-1-launch.md](crm-release-1-launch.md): Supabase Auth settings,
the two real accounts, applying the migrations to production, the Vercel project
and hostname, and a native Arabic read of the new interface text.
