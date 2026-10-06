# Client intake release: project type and client emails

Branch `feat/client-intake`, based on production `main` (`031faba`). Nothing
here is live. This note is what to check before it is.

## What it contains

1. **Project type question** on the Start Project form (English and Arabic):
   Website, Web application, Mobile application, Not sure yet. Required on the
   form. Stored as `website`, `web_app`, `mobile_app`, `not_sure`.
2. **Acknowledgment email** to the client after a saved inquiry, in the
   language of the form they used.
3. **Branded internal notification**: HTML with the plain-text alternative,
   now including the project type.
4. `npm run email:preview` to review every template locally.

## Rules the project type follows

- Only an explicit choice on the form is stored in `project_type`. Nothing
  infers it from the written brief.
- Existing inquiries, and any sent by an older cached copy of the form, have
  no value. They show as **Not provided**, never as "Other".
- The server accepts a missing value (so cached forms still work) but, when
  present, accepts only the four values above. The form itself requires it.
- A future suggestion made by software or by the team (for example "Suggested
  from the brief", editable by Omar or Adam) must be stored in its own column,
  never in `project_type`, so the dashboard can always separate what the client
  said from what we think. That column does not exist yet and is not part of
  this release.
- The older database values `website_and_mobile` and `other` stay allowed in the
  column, but the form never offers them, so they are not treated as the
  client's choice.

## The acknowledgment email

- **When:** only after the inquiry is saved, inside the same post-response step
  as the internal notification. A retry, an already-known submission token and
  a race to the unique index all return before that step, so one inquiry gets
  one acknowledgment (proved in `src/app/api/inquiries/route.test.ts`).
- **Never blocks anything:** the form response and the booking do not wait for
  it and cannot fail because of it. A Resend failure is logged as an event name
  plus the provider's error type, with no address, name or provider message.
  The client sees nothing.
- **Content:** confirms receipt, says we read the idea before the call, offers
  one action (choose a call time). It promises no proposal, design, estimate or
  response time.
- **Subject (fixed):** `We received your project inquiry` /
  `وصلنا طلب مشروعك`.
- **Greeting:** the email goes to whatever address was typed, which may not be
  the sender's own. The visitor's name is used only if it looks like a plain
  name (at most 60 characters, no link, address or markup characters).
  Otherwise the greeting is just "Hello,".
- **Sending switch:** it obeys `EMAIL_SENDING_MODE` like every email. With
  `disabled` (the admin review setting, and the default outside production)
  nothing is sent. Tests and CI can never send.

### Booking link, expiry and fallback

The button links to the Cal.com page with the same signed inquiry reference the
on-page scheduler uses (`metadata[bookingContext]`).

- The reference is valid for **7 days**.
- **Within 7 days:** a booking made from the email is linked to the inquiry by
  the Cal.com webhook, exactly like one made on the page.
- **After 7 days:** the page still works and the client can still book, but the
  webhook ignores a `BOOKING_CREATED` without a valid reference, so the booking
  is not linked to the inquiry. The team still gets Cal.com's own booking email.
- **No link at all:** if signing fails or no calendar is configured, the email
  has no button and says we will contact the client to arrange a time.
- A client who already booked on the page after sending is told they are all
  set; Cal.com sends that confirmation separately.

## Environment variables (names only; nothing was set in Vercel)

| Name | Purpose |
| --- | --- |
| `INQUIRY_ACK_FROM` | Sender of the acknowledgment. Proposed: `Mintapp <hello@mail.mintapp.tech>` |
| `INQUIRY_ACK_REPLY_TO` | Reply-To of the acknowledgment. Proposed: `hello@mintapp.tech` |

Both are required for the acknowledgment to send; with either missing it is
skipped and logged (`client_ack_not_configured`). The internal notification's
own variables are unchanged. `mail.mintapp.tech` has no inbox, which is why
Reply-To must be the `hello@` mailbox.

## Migration

`supabase/migrations/20261004000000_allow_not_sure_project_type.sql`: widens the
`project_type` check constraint by one value, `not_sure`. Additive, no data
change, ASCII-only. **Not applied anywhere by this work.**

Apply it to production **before** deploying the form. If the code is deployed
first, an inquiry that chose "Not sure yet" is still saved, without that answer
(`project_type_rejected_by_database` is logged), so no lead is lost, but the
answer is.

The timestamp sorts after the booking-ledger migration that is still deferred
on `feat/pending-booking-workflow` and before the admin branch's migrations, so
the order stays natural when the branches meet. No migration was added for
email logging: idempotency does not need one.

## Release order (when you decide to release)

1. Apply the migration to production by hand (this one file only, never "apply
   all pending migrations").
2. Set `INQUIRY_ACK_FROM` and `INQUIRY_ACK_REPLY_TO` in Vercel Production.
3. Merge and deploy.
4. One controlled live test per language, like the earlier one.

Rollback: Vercel Instant Rollback to the previous deployment. The migration is
safe to leave in place.

## Branch strategy

- `main` stays the source of truth; `feat/client-intake` starts from its latest
  commit and contains only public-site work (form, API, emails, one migration).
- The admin application lives on `feat/inquiry-preparation` (previewed from
  `review/admin-preview`), started from an older `main`. It has its own
  display changes for the project type.
- Merge order: `feat/client-intake` into `main` first. Then merge `main` into
  `feat/inquiry-preparation` with an ordinary merge commit (no rebase, no force),
  which brings the newer production commits into the admin branch.
- Migration history: the admin branch carries a byte-identical copy of
  `20261004000000_allow_not_sure_project_type.sql`, so that merge sees the same
  file on both sides and has nothing to conflict on. The admin migrations
  (`20261005...`, `20261006...`) sort after it.
- `src/lib/project-types.ts` is on this branch only. The admin branch keeps its
  own labels until the merge, after which it can import the shared module.

## Later manual step: Cal.com organizer email (not done)

Clients currently see `dev@mintapp.tech` as the organizer on Cal.com's emails.
To show `hello@mintapp.tech` instead, in Cal.com: add `hello@mintapp.tech` as an
additional email on the profile, verify it, and select it as the email used for
the discovery-call event type. Cal.com documents this as available without a
paid plan; check the exact labels when you do it. Nothing in this branch
changes Cal.com. Custom styling of Cal.com's emails needs a paid plan.
