# Two-founder CRM: corrected workflow (technical design)

Branch `feat/two-founder-crm`, started from `feat/crm-release-1` at `01d6c9f`.
This is the technical design for the corrected Release 1. It is not the operations
manual; that is written after the Preview is approved and the wording is frozen.

## 1. Starting state (verified 10 Oct 2026)

| Branch | Commit | Relation |
| --- | --- | --- |
| `main` | `4af3296` | production; 83 commits behind `feat/crm-release-1` |
| `feat/crm-release-1` | `01d6c9f` | CRM Release 1; contains everything below |
| `review/admin-preview` | `01d6c9f` | fast-forwarded by the owner to `feat/crm-release-1`; its admin Preview built (`mintapp-admin-review`) |
| `feat/client-intake` | `d79d979` | released intake; fully contained in `feat/crm-release-1` |
| `feat/inquiry-preparation` | `867df71` | preparation pipeline; fully contained in `feat/crm-release-1` |

No feature lives only on another branch, so nothing needs porting: every required
piece (intake, booking webhook, preparation jobs, Supabase Auth, the CRM tables) is
already on `feat/crm-release-1`. The deferred booking-ledger migration lives only on
`feat/pending-booking-workflow` and stays there.

## 2. What the corrected release changes, in one line each

| Area | Today (Release 1 as built) | Corrected |
| --- | --- | --- |
| Primary navigation | 8 links: Dashboard, Inquiries, Pipeline, Outreach, Companies, Proposals, Projects, Metrics | 4: Dashboard, Leads & Clients, Projects, Growth; a small "More" menu for Settings and Companies |
| Sales stages shown | 13 | 7: New, Reviewing, Meeting, Qualified, Proposal, Decision, Closed (Won / Lost); Paused becomes a flag with a resume date |
| Lead score | seven 0-2 categories on the main form | optional High / Medium / Low priority; the seven-part score moves into a collapsed Advanced area |
| Inquiry page | one long page with ~10 panels | four tabs: Overview, Pre-meeting Pack, Deal, Activity |
| Preparation | one text draft, queued as soon as an inquiry arrives | a Pre-meeting Pack of three artifacts (initial design, draft proposal, discovery pack), generated only after a booking or on "Prepare now" |
| Next action after booking | none created | "Review and approve the pre-meeting pack", due the day before the meeting, moved on reschedule, closed on cancellation |
| Public form | no budget, timeline or existing link | adds budget range, expected timeline and an existing website/app link; the sensitive-data warning moves above the description |
| Dashboard | 8 KPI cards plus 10 sections, empty ones shown | a command centre: today's actions, meetings, packs to review, leads awaiting a reply, projects, each founder's work, campaign, alerts; empty sections hidden |
| Outreach | 17-field prospect form | six primary fields; research fields in an optional expanded section |

## 3. Data: reused, added, removed

Nothing is dropped. The 13-stage column, the seven-part score and every audit table stay;
the interface shows less of them.

### Reused as is

| Need | Existing storage |
| --- | --- |
| Budget range, expected timeline | `project_inquiries.budget_range`, `.timeline` (text, max 100; present since 2026-08, never filled by the form) |
| Existing website/app link | `project_inquiries.company_url` (text, max 500; never filled by the form) |
| Meeting date, client time zone | `project_inquiries.meeting_start_at`, `.meeting_timezone` (from the Cal.com webhook) |
| Meeting / manage link | derived from `cal_booking_id` as `https://cal.com/booking/<uid>` (the rule `booking-recovery.ts` already uses). The webhook still never stores video-call URLs |
| Commercial position | `project_inquiries.lead_status` (the 13 values); the app writes only `new, reviewing, meeting_booked, qualified, proposal_prep, negotiation, won, lost` |
| Paused flag + resume date | `inquiry_crm.paused_until` (the app no longer writes the `paused` stage) |
| Final proposal, agreed scope | `crm_proposals` (versioned, teammate approval) |
| Won to project | `crm_projects`, `crm_convert_to_project` |
| Next actions | `inquiry_follow_ups` (one responsible person, a due date) |
| Notes, audit trail | `inquiry_notes`, `crm_activity`, `crm_stage_history` |
| Pack artifact versions and approval | `preparation_drafts` (versioned jsonb, source, review status, author, reviewer) |
| Pack job and automation pause | `inquiry_preparations`, `automation_control`, `generation_usage` |
| Prospects, touches | `crm_prospects`, `crm_outreach_touches` |

### Added (additive migrations, each with a rollback script)

| Addition | Why |
| --- | --- |
| `inquiry_preparations.status` gains `waiting_booking` | no generation before a booking |
| `preparation_drafts.artifact` (`note` for existing rows; `design`, `proposal`, `discovery`) | three artifacts in the existing versioned table, one version sequence per inquiry |
| `inquiry_follow_ups.kind` (`manual` default, `pack_review`) and a nullable owner for automatic actions only | the automatic next action, which the booking trigger moves and closes |
| `crm_settings` (key, value) with `default_owner` | who is responsible for an automatic action when the inquiry has no owner |
| `inquiry_crm.priority`, `crm_prospects.priority` (high/medium/low) | the simple priority |
| `inquiry_crm.contract_status`, `.contract_signed_on`, `.contract_reference`, `.commercial_notes` | the Deal tab (contracts are signed outside the CRM) |
| triggers on booking changes | queue the pack and create, move or close the review action |
| functions for the pack, settings and the simplified reads | the app calls nothing else |

### Removed from the interface (still stored)

The 13-stage selector and board columns, the seven-part score on ordinary forms, the
separate Inquiries / Pipeline / Companies / Proposals / Metrics pages as primary
destinations (their addresses redirect), and technical status names on the dashboard.

## 4. The corrected workflow

1. **Inquiry arrives** (public form). Saved with its pack job in `waiting_booking`. The
   acknowledgment email and the booking page work exactly as today. Shown as
   *Waiting for booking*. No generation runs. A founder may choose **Prepare now**.
2. **Meeting booked** (Cal.com webhook, unchanged). A database trigger moves the job to
   `queued` and creates the action *Review and approve the pre-meeting pack*, due the day
   before the meeting (Cairo calendar, never before today), owned by the inquiry's first
   owner or the default owner from Settings. The webhook then asks the worker to run
   (best effort; generation is off unless configured).
3. **Pack generated** (CodeCraft, synthetic-only until approved) or **prepared manually**
   (copy a sanitised prompt into Claude Pro, paste the result back). Either way three
   artifacts are saved as versions.
4. **Review**: each artifact is marked ready and approved by the founder who did not
   write it. All three approved = *Approved for meeting*.
5. **Rescheduled**: the action's due date moves; the pack is untouched.
   **Cancelled**: the action is closed by the system, the pack is kept, the meeting
   shows *Cancelled*. A new booking creates a new action.
6. **After the meeting**: the commercial position moves (Qualified, Proposal, Decision,
   Closed). The final proposal and the contract status live on the Deal tab.
7. **Won and signed**: the lead becomes a project.

### Pack state (plain language)

| State | When |
| --- | --- |
| Not started | waiting for a booking |
| Preparing | queued or running with automation on |
| Needs manual action | automation off, paused, failed, or the project type has no pattern; no complete pack yet |
| Ready for review | all three artifacts exist and at least one is not approved |
| Approved for meeting | the latest version of all three is approved |
| Needs attention | the review deadline has passed and the pack is not approved |

## 5. Genuine decisions for Omar (not blockers)

1. **Budget ranges.** No pricing decision exists in the repositories. The form ships
   with a configurable list in `src/lib/form-options.ts`, marked provisional, which needs
   Omar's approval before release.
2. **Default owner** for automatic actions when an inquiry has no owner. Set in Settings;
   until set, such an action is shown as *Needs an owner*.
3. **Review deadline**: the day before the meeting. One constant; change on request.

## 6. The Pre-meeting Pack

One generation (or one manual paste) returns one strict JSON object
(`src/lib/pack/schema.ts`), validated before anything is saved, then split into three
artifacts stored as versions in `preparation_drafts`:

| Artifact | Content |
| --- | --- |
| Initial design (`design`) | pattern id, audience, primary goal, information hierarchy, responsive notes, brand context, 2-4 screens (template id + short text slots), user flow |
| Draft proposal (`proposal`) | understanding, recommended solution, first-release scope, phases, deliverables, assumptions, exclusions, what affects cost or schedule, next step. Always shown under *Initial draft for discussion — not a final quote or commitment.* |
| Discovery pack (`discovery`) | client facts (each quoting the brief), assumptions, missing information, questions with their purpose, risks, decisions the client must take, meeting agenda, what to confirm before scope and pricing |

Rejected before saving: unknown keys, a fact whose evidence is not in the brief, any
figure the client did not state, a promise or guarantee (English or Arabic), a pattern
or template outside the library, a pattern that contradicts the client's project type,
fewer than two screens, a flow through screens that do not exist. A brief no pattern
fits gets `pattern: null` and a reason: the design is then made by hand and the pack
shows *Needs manual action*. Each artifact is reviewed and approved separately by the
founder who did not write it; approving a new version supersedes only that artifact's
earlier approval.

## 7. CodeCraft (OpenAI-compatible gateway)

- Adapter: `src/lib/preparation/codecraft-generator.ts` behind the `PreparationGenerator`
  interface; JSON mode; the key is read only on the server and never logged or returned.
- **Off by default.** Real inquiries also need `CODECRAFT_CLIENT_DATA_APPROVED=true`,
  which is not set anywhere.
- Failure handling: 402, "insufficient / quota / balance / credit / allowance" wording,
  401/403 and unknown model pause automation (no retry) and the pack shows *Needs manual
  action*; timeouts, 429 (with Retry-After), 5xx and malformed output are retried with
  increasing delays, at most 3 attempts; a cut-off answer is not retried. The inquiry
  and the booking never wait for any of it.
- Budget: the app's monthly limit (default 600,000 tokens, never above 1,000,000) is
  checked before every request against the worst case (prompt estimate plus the output
  limit). Usage is recorded as counts with the model id.
- Output limit: `PREPARATION_MAX_OUTPUT_TOKENS`, default 10,000. Reasoning models count
  hidden reasoning as completion tokens; see the evaluation below.
- Audit: the exact sanitised input sent (brief, prompt version, model, language, project
  type) is stored in `inquiry_preparations.last_payload` and shown on the pack tab.

### Model discovery and synthetic evaluation (10 Oct 2026)

`GET /v1/models` returned 33 models, every one advertising `json_mode` (most also
reasoning, tools, vision), with per-1k pricing metadata. Evaluated on synthetic briefs
only (`src/lib/preparation/eval.live.test.ts`), hard cap 60,000 tokens:

| Call | Model | Result | Tokens |
| --- | --- | --- | --- |
| English clinic brief, 6,000 output limit | `claude-sonnet-5` | provider 5xx after 34 s | 9,111 counted (worst case; not reported) |
| Diagnostic, same brief | `claude-sonnet-5` | cut off at 6,000 completion tokens | 7,652 |
| Five one-line pings (JSON mode, reasoning overhead) | four models | all valid | 3,196 |
| English clinic brief, 8,192 output limit | `claude-sonnet-5` | cut off again | 9,844 |
| English clinic brief | **`gemini-3.7-flash`** | valid pack, all checks pass, 4/4 expected facts, `scheduling_app` | 6,139 |
| Arabic school brief | **`gemini-3.7-flash`** | valid pack, all checks pass, 4/4 expected facts, `academy_site` | 9,410 |
| **Total** | | | **45,352 (at most)** |

Selected exact model id: **`gemini-3.7-flash`** (context 1,048,576; reasoning, vision,
tools, JSON mode). The Arabic output is fluent Modern Standard Arabic, with facts quoting
the brief and no invented figures; its completion used 7,701 tokens, close to the old
8,192 limit, hence the 10,000 default. Pricing metadata is returned per 1k tokens; the
free allowance and the gateway's data retention are not documented by the API and are
not assumed.

## 8. Later in this document

Sections for the pack schema, CodeCraft, privacy, the renderer, failure recovery,
migrations and rollback are added as each milestone lands.
