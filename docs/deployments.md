# Deployment Record

Non-secret log of production deployments and their verification. No project URL, API key, or credential value appears anywhere in this file, and none should ever be added to it. Companion to [`docs/supabase-database-permissions.md`](./supabase-database-permissions.md) — that file explains the database's standing configuration; this one records what was actually shipped and verified, deployment by deployment.

## 2026-08-23 — Cloudflare Turnstile bot protection (Phase 2 lead capture)

**Production commit:** `ab6b320` (pushed to `origin/main` as a fast-forward from `0eb60a6`, 10 commits).

**What shipped:** server-side Cloudflare Turnstile verification on `/api/inquiries` (hostname/action/timeout all fail-closed), the Start-form widget integration, a real-email fail-safe (`EMAIL_SENDING_MODE`) so a valid `RESEND_API_KEY` alone can no longer trigger a real send, a `disabled` notification-status value for intentionally-skipped sends, and privacy-policy disclosure of the new processor. Full technical detail is in the commit messages themselves (`git log b5b01ec..ab6b320`).

**Live verification completed:**
- `/en`, `/ar`, `/en/start`, `/ar/start`, `/en/privacy`, `/ar/privacy` all return `200` with correct `dir`/`lang`.
- Turnstile initializes on both Start pages (real production widget, confirmed via network trace).
- One real English smoke-test inquiry was submitted by a human (not automated — Turnstile is specifically designed to distinguish real users from automation, so this step deliberately wasn't scripted): Supabase row created, `notification_status` reached `sent` with `notification_sent_at` populated, exactly one Resend email delivered.
- Arabic Start page verified for RTL layout, copy, widget initialization, and client-side validation — **not submitted**, by design (the smoke test is English-only per the verification procedure).

**Smoke-test row:** created, verified, then deleted by the project owner directly via the Supabase SQL editor (the app's `service_role` key has no DELETE grant — see `docs/supabase-database-permissions.md`). Table confirmed empty of test data afterward.

**Required production environment variables** (names only — real values live in Vercel's Production-scoped environment variables and the team password manager, never in this repo):
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `RESEND_API_KEY`
- `INQUIRY_NOTIFICATION_FROM`
- `INQUIRY_NOTIFICATION_TO`
- `INQUIRY_NOTIFICATION_REPLY_TO`
- `EMAIL_SENDING_MODE`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`

**`EMAIL_SENDING_MODE` must stay environment-appropriate:**
- Local development: **`disabled`**. Real delivery requires a deliberate, momentary opt-in — never leave it set to `send` locally.
- Production (Vercel): **`send`**. Production requires an explicit valid value; a missing or invalid value produces a controlled configuration error and prevents notification delivery (evaluated per-request, inside the deferred post-response notification step — see `resolveEmailSendingMode()` in `src/lib/email-sending-mode.ts` and its call site in `src/lib/send-inquiry-notification.ts`, invoked from `route.ts`'s `after()` callback — not at application startup or module load).

**Outstanding security task — high priority:** Supabase, Resend, and Turnstile credential values appeared in private tool output during this engagement. Rotation was deliberately deferred by the project owner rather than done immediately, but remains an open task and should not be forgotten.

**Rollback target/procedure:** Vercel dashboard → Deployments → the deployment currently marked Production immediately prior to this one (built from `origin/main` at `0eb60a6ff73a8d67fc2ac66a94f28cbedd9124d8`) → **Instant Rollback**. This redirects production traffic without touching git history or requiring a rebuild. The Supabase migration shipped in this deployment (`20260823120000_allow_disabled_notification_status.sql`) is additive/backward-compatible and does not need to be rolled back alongside the code.

**Rerunning tests:**
```bash
npm run test        # Vitest — unit/integration suite
npm run test:e2e    # Playwright — browser suite (starts its own dev server; needs `npx playwright install chromium` once)
```

## 2026-09-05 — Cal.com meeting scheduling: backend webhook + frontend embed

**Production commits:**
- Backend webhook: `af554c4`, `00619b2`, `8a54f5e`
- Frontend embed: `98d205b`, `26a980d`, `d8dd231`
- Vercel Production source commit at time of this verification: `d8dd231`

**What shipped:**
- **Backend** — `POST /api/webhooks/cal`, an event-type-scoped Cal.com webhook using payload version `2021-10-20`, handling exactly three triggers: `BOOKING_CREATED`, `BOOKING_CANCELLED`, `BOOKING_RESCHEDULED`. Every request is HMAC-verified over its exact raw bytes before any parsing, then staged through envelope/routing/full-schema validation before any database access. Bookings correlate to `project_inquiries` rows through short-lived, HMAC-signed context tokens (never a bare id), applied through three atomic, ordering-guarded Postgres RPC functions (`SECURITY INVOKER`, `service_role`-only).
- **Frontend** — after an accepted Start-form submission, the server signs a booking-context token (best-effort; a signing failure never fails the underlying inquiry) and the client renders an inline Cal.com scheduler (`@calcom/embed-react`, pinned exact version) using the officially documented `metadata[key]` config mechanism. Includes a namespaced embed instance, a 15-second readiness timeout with a clean retry path, bilingual (EN/AR) copy, and an updated privacy-policy disclosure covering the direct browser-to-Cal.com connection and the nature of the signed reference (integrity-protected, not encrypted, not secret).

**Live verification completed (real, non-mocked, full lifecycle):**
One real, clearly-labeled QA inquiry was submitted through the live Start form and taken through submit → book → reschedule → cancel, checked via read-only Supabase queries after each stage. Confirmed:
- The signed booking-context token issued at submission reached Cal.com and correctly correlated the resulting `BOOKING_CREATED` webhook to the correct inquiry row.
- The attendee-reported timezone (`Africa/Cairo`) was captured into `meeting_timezone` — a genuine reported value, never the hardcoded fallback the design forbids.
- A genuine reschedule occurred on Cal.com's side (confirmed via Cal.com's own UI).
- A genuine cancellation updated the correct inquiry row to `booking_status = cancelled`, and the rescheduled → cancelled transition strictly increased `cal_booking_event_at`, confirming the ordering guard behaved correctly across that specific transition.
- The QA row was deleted afterward by an exact-match filter, with row counts confirmed both immediately before (`1`) and after (`0`) deletion — no collateral rows touched.

**Known evidence limitation — the created → rescheduled transition:** this was **not conclusively proven**. No clean before/after database read bracketed the reschedule action itself, so it is not established from this test that the `BOOKING_RESCHEDULED` webhook updated the inquiry, that `meeting_start_at` changed in the database, or that `cal_booking_event_at` increased between the created and rescheduled stages. Cal.com's UI confirms a reschedule happened on the provider side, but that does not by itself prove our webhook/RPC applied the corresponding database transition. Closing this fully would require a further, narrow QA cycle checking `meeting_start_at` and the raw ordering timestamp on both sides of a reschedule specifically.

**Known evidence limitation — metadata presence on cancellation/reschedule:** delivery-level payload inspection was not available during this verification, so it remains **unverified** whether `metadata.bookingContext` is actually present on the real `BOOKING_CANCELLED`/`BOOKING_RESCHEDULED` webhook payloads. The successful cancellation in this test does not establish this: once `BOOKING_CREATED` had already stored `cal_booking_id` on the row, the cancellation could have correlated purely through that stored booking UID (the designed fallback path) with or without `bookingContext` present.

**Required production environment variables** (names only, matching this file's existing convention):
- `NEXT_PUBLIC_CAL_LINK`
- `CAL_EVENT_TYPE_ID`
- `CAL_WEBHOOK_SECRET`
- `CAL_BOOKING_CONTEXT_SECRET`

No secrets, inquiry IDs, booking UIDs, meeting URLs, personal data, or exact QA timestamps appear in this record.

**Rerunning tests:**
```bash
npm run test
npm run test:e2e
```
