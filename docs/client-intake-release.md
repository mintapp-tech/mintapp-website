# Client intake release: project type, client emails and booking recovery

Branch `feat/client-intake`, based on production `main` (`031faba`). Nothing
here is live. This note is what to check before it is.

## What it contains

1. **Project type question** on the Start Project form (English and Arabic):
   Website, Web application, Mobile application, Not sure yet. Required on the
   form. Stored as `website`, `web_app`, `mobile_app`, `not_sure`.
2. **Acknowledgment email** to the client after a saved inquiry, in the
   language of the form they used, with a way back to the booking step.
3. **Booking recovery page** (`/en/book`, `/ar/book`): the page behind the
   email's button. It is decided on the server and never offers a booking that
   could be unlinked from its inquiry or duplicate an existing one.
4. **Booking fixes**: the signed inquiry reference now lasts 30 days, and a
   client who cancelled can book again and stay linked to the same inquiry
   (this needed a database change; see Migrations).
5. **Branded internal notification**: HTML with the plain-text alternative,
   including the project type.
6. `npm run email:preview` to review every template locally.

## The normal workflow

1. The client submits the project form.
2. The inquiry is saved.
3. The website immediately shows the Cal.com scheduler.
4. Mintapp sends the acknowledgment email, after the inquiry is saved.
5. If the client has not already booked, the email lets them return and choose a
   time. This is a recovery path, not a replacement for the scheduler in step 3.
6. Cal.com sends the booking, cancellation and rescheduling messages.

## The acknowledgment email

Sent once per newly saved inquiry, in the form's language. Subject (fixed):
`We received your project inquiry` / `وصلنا طلب مشروعك`. It confirms receipt,
says we read the idea before the call, and promises no proposal, design,
estimate or response time. It never says the client must book twice, and never
says Mintapp arranges every meeting by hand.

### The normal email (every ordinary submission)

Contains the line below and one button, **Choose a call time** /
**اختر وقت المكالمة**:

- English: "If you haven’t already chosen a time, you can select one below."
- Arabic: "إذا لم تكن قد اخترت موعدًا بعد، يمكنك اختيار الوقت المناسب أدناه."

followed by a note that Cal.com sends the booking confirmation separately. A
client who already booked on the page simply ignores it.

### The technical fallback (not a second kind of email)

The version that says "We will contact you to arrange a time for a 30-minute
discovery call" has no button and is used **only** when a safe booking link
cannot be made:

| Condition | Logged as |
| --- | --- |
| No calendar configured (`NEXT_PUBLIC_CAL_LINK` missing or malformed) | `client_ack_fallback: no calendar is configured` |
| The signed reference could not be created (signing secret missing) | `client_ack_fallback: the booking reference could not be signed` |

It is **never** used because the client has not booked yet: that is the normal
case and gets the normal email. It still says the inquiry was received. The
HTML and plain-text versions of both emails carry the same sentences (tested).
An email problem of any kind never affects the form response or the booking.

### Sending safeguards

- Only after the inquiry is saved; never during the request.
- It obeys `EMAIL_SENDING_MODE` like every email: `disabled` (the admin review
  setting, and the default outside production) sends nothing; tests and CI can
  never send.
- A provider failure is logged as an event name plus the provider's error type,
  with no address, name, phone, brief or provider message. The client sees
  nothing.
- The email may go to an address that is not the sender's own, so the visitor's
  name appears only if it looks like a plain name (at most 60 characters, no
  link, address or markup). Otherwise the greeting is just "Hello,".

## The booking recovery page

The button links to `https://www.mintapp.tech/<lang>/book?ref=<signed reference>`,
never straight to Cal.com. On every request the server verifies the reference,
then reads the inquiry's **current** booking status:

| What the server finds | What the client sees |
| --- | --- |
| `not_booked` | The scheduler, with a **fresh** reference so a booking started now cannot expire half way |
| `cancelled` | The scheduler again, linked to the same inquiry |
| `booked` (including a rescheduled booking, which stays `booked` with the new time) | "Your call is already scheduled", the time, and Cal.com's own page to reschedule or cancel. **No second scheduler** |
| `completed`, `no_show` | "We already have a call for this inquiry" and the support address. No scheduler |
| Missing, malformed, tampered, expired (over 30 days), signed for an inquiry that does not exist, or deleted | One identical page: "This link can't be used", the support address, and a button to start a new inquiry |
| A database or configuration fault | "We couldn't check your booking just now", the support address. No scheduler |

- **Fail closed.** A scheduler is shown only after the status was verified. The
  database is read only after the signature verifies, so a guessed or garbled
  link never reaches it, and every unusable link gets the identical page, so it
  cannot reveal whether a record exists.
- **Cal.com management link.** For a booked inquiry the page links to
  `https://cal.com/booking/<booking id>` only when the stored id is a plain
  Cal.com id. That id is what Cal.com's own confirmation email already gives the
  client, so this adds no new exposure.
- **Private page.** Not cached, `noindex`, no referrer, absent from the sitemap.
- **Logs** say what failed, never who: no inquiry id, reference or booking id.

## The signed inquiry reference

Verified before the lifetime was extended from 7 to **30 days** (tests prove each
point):

- It contains only an opaque inquiry id and an issue time. No name, email,
  phone or brief.
- It is signed with HMAC-SHA256 and compared in constant time. Changing any
  single character, or signing without the secret, makes it invalid.
- It is short and URL-safe, and verifying it returns only the inquiry id.
- It is used only to associate a booking with its inquiry. It is bearer-style:
  whoever holds the link can use the page, like the booking links Cal.com sends.
- After 30 days the page shows the "can't be used" message rather than a
  scheduler, so an old link can never create an unlinked booking. The client can
  write to `hello@mintapp.tech` or start a new inquiry.

## Preventing duplicate and disconnected bookings

Cal.com itself creates bookings, and Mintapp does not change Cal.com, so the
protection is in what we show and what we record:

1. **The page** shows a scheduler only for `not_booked` or `cancelled`
   inquiries, decided on the server on every load (not by a disabled button).
2. **The database** records at most one active booking per inquiry.
   `apply_booking_created` is one atomic conditional update: a row that holds an
   active booking refuses any other booking id, so two tabs, a double click or a
   retry cannot replace the first booking. Proved on a real Postgres, including
   four simultaneous bookings of which exactly one is recorded.
3. **Cancelled bookings can be replaced** (see Migrations), so a rebooking is
   linked, not detached.
4. **Visibility.** If a second active booking is refused, the webhook logs one
   fixed line, `cal_webhook_duplicate_active_booking_ignored` (no ids), so the
   extra booking can be found in Cal.com. The webhook response stays the same
   for every refused event.

What this cannot do: if a client already had two scheduler tabs open and books
in both, Cal.com will create both bookings. Mintapp links the first and ignores
the second (with the log line above); the second booking and its Cal.com emails
remain in Cal.com until cancelled there. Preventing it at Cal.com would be a
Cal.com setting (for example limiting bookings per attendee), which this work
does not change. Cal.com's existing 48-hour notice and immediate confirmation
are untouched.

## Email and submission idempotency

Proved by `src/app/api/inquiries/intake-flow.test.ts` (real route, insert,
duplicate lookup and both email senders; fake database with a unique submission
token, and a fake provider):

- A new inquiry sends one acknowledgment and one internal notification.
- A repeated submission token sends nothing new.
- Six simultaneous identical requests create one inquiry and one acknowledgment.
- Either email failing does not stop the other, the response or the booking
  reference.
- `EMAIL_SENDING_MODE=disabled` sends nothing.
- Logs contain no name, address, phone, company, brief, token or provider
  message.
- English and Arabic selection, and escaping of every client-controlled value.

## Rules the project type follows

- Only an explicit choice on the form is stored in `project_type`. Nothing
  infers it from the written brief.
- Existing inquiries, and any sent by an older cached copy of the form, have
  no value. They show as **Not provided**, never as "Other".
- The server accepts a missing value (so cached forms still work) but, when
  present, accepts only the four values. The form itself requires it.
- A future suggestion made by software or by the team ("Suggested from the
  brief", editable by Omar or Adam) must be stored in its own column, never in
  `project_type`. That column does not exist yet and is not part of this release.
- The older values `website_and_mobile` and `other` stay allowed in the column,
  but the form never offers them, so they are not treated as the client's choice.

## Environment variables (names only; nothing was set in Vercel)

| Name | Purpose |
| --- | --- |
| `INQUIRY_ACK_FROM` | Sender of the acknowledgment. Proposed: `Mintapp <hello@mail.mintapp.tech>` |
| `INQUIRY_ACK_REPLY_TO` | Reply-To of the acknowledgment. Proposed: `hello@mintapp.tech` |

Both are required for the acknowledgment to send; with either missing it is
skipped and logged (`client_ack_not_configured`). The recovery page also needs
`CAL_BOOKING_CONTEXT_SECRET`, `NEXT_PUBLIC_CAL_LINK`, `SUPABASE_URL` and
`SUPABASE_SECRET_KEY`: the same ones the existing scheduler, webhook and
inquiry route already require, so check they are set rather than add them. `mail.mintapp.tech` has no
inbox, which is why Reply-To must be the `hello@` mailbox.

## Migrations (two, additive, neither applied anywhere by this work)

1. `20261004000000_allow_not_sure_project_type.sql` widens the `project_type`
   check constraint by one value. Apply it **before** deploying the form; if the
   code goes first, an inquiry that chose "Not sure yet" is still saved, without
   that answer.
2. `20261007000000_allow_rebooking_after_cancellation.sql` replaces one function,
   `apply_booking_created`, with one extra condition: a row whose booking is
   `cancelled` also accepts a new booking id.

   **Why it is needed:** a cancellation keeps the cancelled booking's id on the
   inquiry, and the function only accepted that id, so any new booking after a
   cancellation (from the page, not just from email) was silently refused and
   stayed unlinked. Without this migration the recovery page still works, but a
   rebooking after a cancellation is not linked, exactly as today. Active
   bookings still refuse any other id, completed and no-show rows are unchanged,
   the event-order guard still ignores late replays, and privileges are
   unchanged. It does not touch the deferred booking-ledger work on
   `feat/pending-booking-workflow`.

   `tests/db/booking-rebook.test.mjs` proves this on a real Postgres, and, run
   without the migration, the rebooking case fails. It needs the Postgres
   harness from `feat/inquiry-preparation`, so it runs under `npm run test:db`
   once the branches are merged. Until then
   `src/lib/booking-rebook-migration.test.ts` guards the migration's shape.

The timestamps sort after the deferred booking-ledger migration and before the
admin branch's migrations, so the order stays natural when the branches meet.
No migration was added for email logging: idempotency does not need one.

## Release order (when you decide to release)

1. Apply both migrations to production by hand, one file at a time (never "apply
   all pending migrations").
2. Set `INQUIRY_ACK_FROM` and `INQUIRY_ACK_REPLY_TO` in Vercel Production.
3. Merge and deploy.
4. One controlled live test per language: submit, book on the page, then open the
   email button and see "already scheduled"; cancel, then use the button to book
   again and confirm the new booking is linked.

Rollback: Vercel Instant Rollback to the previous deployment. Both migrations are
safe to leave in place.

## Branch strategy

- `main` stays the source of truth; `feat/client-intake` starts from its latest
  commit and contains only public-site work.
- The admin application lives on `feat/inquiry-preparation` (previewed from
  `review/admin-preview`), started from an older `main`.
- Merge order: `feat/client-intake` into `main` first. Then merge `main` into
  `feat/inquiry-preparation` with an ordinary merge commit (no rebase, no force).
- The admin branch carries a byte-identical copy of the `not_sure` migration, so
  that merge has nothing to conflict on. The rebooking migration is only on this
  branch, and arrives with the merge.
- `src/lib/project-types.ts` is on this branch only. The admin branch keeps its
  own labels until the merge.

## Later manual step: Cal.com organizer email (not done)

Clients currently see `dev@mintapp.tech` as the organizer on Cal.com's emails.
To show `hello@mintapp.tech` instead, in Cal.com: add `hello@mintapp.tech` as an
additional email on the profile, verify it, and select it as the email used for
the discovery-call event type. Cal.com documents this as available without a
paid plan; check the exact labels when you do it. Nothing in this branch
changes Cal.com. Custom styling of Cal.com's emails needs a paid plan.

## Reviewing the emails locally

```bash
npm run email:preview
```

Writes every template, English and Arabic, as HTML and plain text to
`.email-previews/` (git-ignored); open `.email-previews/index.html`. It sends
nothing and reads no environment variables.
