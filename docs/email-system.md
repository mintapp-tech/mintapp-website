# Email system

What email a client and the team receive today, who sends it, and the proposed
Mintapp templates. No address value from environment variables, key or
personal data appears here. Audited 5 October 2026.

## Inventory (current live behaviour)

| # | Email | Sent by | Audience | Trigger | Format |
|---|-------|---------|----------|---------|--------|
| 1 | New inquiry notification | Mintapp, via Resend (`src/lib/send-inquiry-notification.ts`) | Internal (team) | Accepted Start Project inquiry (fresh insert only; retries and duplicates send nothing) | Plain text |
| 2 | Booking confirmation | Cal.com | Client | Client books in the embed or on the Cal.com page | Cal.com template, with calendar invite |
| 3 | New booking notice | Cal.com | Internal (organizer) | Same booking | Cal.com template |
| 4 | Cancellation | Cal.com | Client and organizer | Booking cancelled | Cal.com template |
| 5 | Reschedule | Cal.com | Client and organizer | Booking moved | Cal.com template |

There is **no Mintapp email to the client** today. A client who sends the
form but does not book receives nothing. There are no reminder or follow-up
emails: Cal.com sends reminders only through Workflows (paid), and Mintapp
sends none.

## Senders, reply-to and subjects

| Email | From | Reply-To | Subject |
|-------|------|----------|---------|
| 1 Internal notification | `INQUIRY_NOTIFICATION_FROM` (value not recorded here; `mail.mintapp.tech` is the only Mintapp domain verified in Resend, per public DNS) | `INQUIRY_NOTIFICATION_REPLY_TO` | `New Mintapp project inquiry` (fixed) |
| 2 to 5 Cal.com emails | Cal.com's default sender, organizer name "Mintapp" | The Cal.com organizer email, currently `dev@mintapp.tech` | Cal.com's default subjects (event title, names and time) |
| Proposed: client acknowledgment | `Mintapp <hello@mail.mintapp.tech>` (suggested) | `hello@mintapp.tech` | EN `We received your project inquiry` / AR `وصلنا طلب مشروعك` (fixed) |

`mail.mintapp.tech` has no inbox (no MX record), so every Mintapp email to a
client must set Reply-To to `hello@mintapp.tech`, which is the Zoho mailbox.

## What we control

**In code (Resend):** everything about emails 1 and the proposed acknowledgment:
HTML and plain-text content, bilingual copy, layout, logo, subject, From
within `mail.mintapp.tech`, and Reply-To.

**Not from our code:** Cal.com emails are generated and sent by Cal.com. Our
application cannot restyle or rewrite them.

**In Cal.com settings (free plan, as far as Cal.com's documentation states):**
- organizer email shown to clients: add `hello@mintapp.tech` as a secondary
  email in the Cal.com profile, verify it, and select it for the event type.
  This replaces `dev@mintapp.tech` as the visible organizer and reply address;
- organizer display name, profile picture (Mintapp mark), event title and
  description.

**Cal.com paid plans:**
- Teams (per user, per month): remove Cal.com branding, brand color on the
  booking page, Workflows with custom email text, and disabling Cal.com's
  default confirmation emails (only allowed once a Workflow email replaces it);
- Organizations: custom SMTP, so Cal.com emails come from our own domain.

The public booking page shows Cal.com branding, consistent with the free plan.

## Proposed Mintapp templates

Code: `src/lib/email/`. Not wired to any live send.

- `layout.ts`: shared layout. Table layout with inline styles; light header
  with the Mintapp mark (`public/email/mintapp-mark.png`, our own server) and
  the name as live text, so blocked images lose nothing; white card with a
  mint top rule; footer. One image, no tracking pixel, no web fonts, no
  third-party resources. Full right-to-left layout for Arabic.
- `client-acknowledgment.ts`: confirms receipt, says we read the idea before
  the meeting, and offers one action ("Choose a call time") to the booking
  page with the signed inquiry reference attached (Cal.com's
  `metadata[bookingContext]` link parameter; the reference is valid for 7
  days). Without a reference it says we will contact the client instead.
  Promises no proposal, design or estimate.
- `inquiry-notification-email.ts`: HTML version of email 1, with the same
  fixed subject and the same plain-text body format as today.

Tests: `src/lib/email/email.test.ts` (escaping, direction, links and
resources, subjects, copy rules, WCAG AA contrast of every text color pair).

### Local review

```bash
npm run email:preview
```

Writes every template, English and Arabic, as HTML and plain text to
`.email-previews/` (git-ignored); open `.email-previews/index.html`. It sends
nothing and reads no environment variables.

## Resend usage

The free plan allows 3,000 emails a month and 100 a day. Today: one email per
accepted inquiry. With the acknowledgment: two per accepted inquiry, so the
daily cap is reached only above 50 accepted inquiries in a day. Turnstile,
the honeypot and the idempotency check already keep bots and retries from
sending.

## Release plan (not done in this milestone)

1. Wire the acknowledgment into `route.ts`'s `after()` step, behind the same
   `EMAIL_SENDING_MODE` switch, with its own new From/Reply-To variables. It
   must never delay or fail the inquiry response.
2. Switch the internal notification to the HTML template (plain text kept as
   the alternative part).
3. Optional, Cal.com settings by the owner: set `hello@mintapp.tech` as the
   organizer email for the discovery-call event.
4. One controlled production test per language, as for the earlier live test.
