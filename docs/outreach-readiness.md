# Outreach readiness: one controlled live test

Goal: prove the live client path once, end to end, before outreach starts:
**Start Project → saved inquiry → notification email → booking recorded.**
It runs on the live site (`main`) as it is today. It needs no migration, no
admin dashboard, no CRM, testimonials or portfolio screenshots.

## 1. Checks that need no submission

| Check | How | Status |
| --- | --- | --- |
| Start Project page loads in English and Arabic, form and Turnstile widget render | Browser, read-only | Verified 5 Oct 2026: both `200`, one form, Turnstile frame loaded, no requests sent |
| Inquiry and webhook endpoints exist | `GET /api/inquiries`, `GET /api/webhooks/cal` | Verified: both `405` (they accept only POST) |
| Production settings present (names and values checked by the owner in Vercel, never pasted anywhere) | Vercel → Project → Settings → Environment Variables, Production | To do (owner): `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`, `INQUIRY_NOTIFICATION_FROM`, `INQUIRY_NOTIFICATION_TO`, `INQUIRY_NOTIFICATION_REPLY_TO`, `EMAIL_SENDING_MODE` (must be exactly `send`), `NEXT_PUBLIC_CAL_LINK`, `CAL_EVENT_TYPE_ID`, `CAL_WEBHOOK_SECRET`, `CAL_BOOKING_CONTEXT_SECRET` |
| Sending domain verified | Resend → Domains: the domain of `INQUIRY_NOTIFICATION_FROM` shows verified (SPF, DKIM) | To do (owner) |
| Cal.com webhook | Cal.com → Settings → Developer → Webhooks: URL `https://www.mintapp.tech/api/webhooks/cal`, secret matches `CAL_WEBHOOK_SECRET`, triggers Booking Created, Rescheduled and Cancelled, active | To do (owner) |
| Cal.com event type | The event in `NEXT_PUBLIC_CAL_LINK` has the id in `CAL_EVENT_TYPE_ID`. Note whether it **requires confirmation**: if so, the live site records the booking only after the host confirms it (booking requests are not handled on `main`) | To do (owner) |
| Database shape | Supabase SQL editor (read-only query below) | To do (owner) |

Read-only database check (live project, SQL editor):

```sql
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'project_inquiries'
  and column_name in ('submission_token', 'notification_status', 'booking_status', 'cal_booking_id', 'meeting_start_at');
-- expect all 5

select proname from pg_proc where proname in ('apply_booking_created', 'apply_booking_rescheduled', 'apply_booking_cancelled');
-- expect all 3
```

## 2. The controlled test submission (owner, at a planned time)

1. In a normal browser, open `https://www.mintapp.tech/en/start` and submit
   with Omar's own email, the name `Mintapp test (Omar)`, and a description
   that starts with `TEST SUBMISSION, delete after the check`.
2. **Saved:** the success screen appears with the booking calendar. In
   Supabase, the newest row for that email exists:
   ```sql
   select id, created_at, notification_status, booking_status, meeting_start_at
   from public.project_inquiries where email = '<Omar test email>'
   order by created_at desc limit 1;
   ```
3. **Notification:** within a minute, `notification_status` is `sent` and the
   email has arrived at `INQUIRY_NOTIFICATION_TO` with the right reply-to.
   (`failed` points to Resend or the email settings; `disabled` means
   `EMAIL_SENDING_MODE` is not `send`.)
4. **Booking:** book a slot in the embedded calendar (confirm it in Cal.com
   if the event requires confirmation). Re-run the query: `booking_status` is
   `booked` with `meeting_start_at` set. If not, open the webhook's delivery
   log in Cal.com: `401` means the secret doesn't match; a `400` on Booking
   Created usually means the booking didn't carry the signed context from
   the success screen.
5. **Cancellation:** cancel the booking in Cal.com; the row shows
   `cancelled`.
6. **Clean up:** mark the test row deleted
   (`update public.project_inquiries set deleted_at = now() where id = '<id>'`)
   so it never counts as a lead.

Check Vercel's runtime logs straight after the test: on the Hobby plan they
are kept for one hour.

## 3. What this does not need

- No database migration. The two dashboard migrations come later (see
  `docs/admin-application.md`). After they are applied, repeat this test once.
  The deferred booking migration on `feat/pending-booking-workflow` stays
  excluded.
- No admin dashboard, CRM, testimonials or remaining portfolio screenshots.
- CodeCraft stays off; preparation for a real inquiry uses the manual Claude
  Pro path.
