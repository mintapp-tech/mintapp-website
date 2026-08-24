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
