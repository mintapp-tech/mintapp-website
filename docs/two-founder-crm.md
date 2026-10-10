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
| Estimated budget, expected timeline | `project_inquiries.budget_range`, `.timeline` (text, max 100; present since 2026-08). New submissions store stable codes (section 5.1) |
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

1. **Budget bands**: approved and implemented (section 5.1).
2. **Default owner** for automatic actions when an inquiry has no owner. Set in Settings;
   until set, such an action is shown as *Needs an owner*.
3. **Review deadline**: the day before the meeting. One constant; change on request.
4. **Real inquiries and CodeCraft**: blocked until written provider and data-processing
   confirmation is received (section 7.7).

### 5.1 Budget and timeline

The public form asks for the **estimated budget**, "in US dollars, or the equivalent in
your currency" (Arabic: «بالدولار الأمريكي، أو ما يعادله بعملتك»), and the expected
timeline. New submissions store a stable code; people only see the label
(`src/lib/form-options.ts`).

| Budget code | English | Arabic |
| --- | --- | --- |
| `under_2500` | Under USD 2,500 | أقل من 2,500 دولار أمريكي |
| `2500_5000` | USD 2,500–5,000 | من 2,500 إلى 5,000 دولار أمريكي |
| `5000_10000` | USD 5,000–10,000 | من 5,000 إلى 10,000 دولار أمريكي |
| `10000_20000` | USD 10,000–20,000 | من 10,000 إلى 20,000 دولار أمريكي |
| `over_20000` | Over USD 20,000 | أكثر من 20,000 دولار أمريكي |
| `not_sure` | Not sure yet | لست متأكدًا بعد |

| Timeline code | English | Arabic |
| --- | --- | --- |
| `asap` | As soon as possible | في أقرب وقت ممكن |
| `within_3_months` | Within 3 months | خلال 3 أشهر |
| `3_to_6_months` | In 3 to 6 months | خلال 3 إلى 6 أشهر |
| `over_6_months` | Later than 6 months | بعد أكثر من 6 أشهر |
| `not_sure` | Not sure yet | لست متأكدًا بعد |

**Older cached forms** sent English labels. They are still accepted by the request schema
(`src/lib/inquiry-schema.ts`):

- every older timeline label, and the budget "Not sure yet", has an exact counterpart and
  is stored as that code;
- the four earlier placeholder budget bands ("Under USD 5,000", "USD 5,000 - 15,000",
  "USD 15,000 - 40,000", "Over USD 40,000") straddle the new bands, so they are stored as
  sent rather than guessed into a different band;
- anything else is refused (`invalid_value`), as before.

**Existing rows are never rewritten**; no migration touches these columns. Every stored
form is displayed with a label: a code or an older label shows its English or Arabic
label; any other stored text (for example free text written before the form asked) is
shown as stored.

**Where the label appears**: the lead's Overview (interface language), the team's
notification email (English: "Budget", "Timeline" rows), and the preparation brief sent to
the generator and copied into the manual Claude prompt (the brief's own language, for
example "Estimated budget (client-stated): USD 5,000–10,000" or «الميزانية التقديرية (كما
ذكرها العميل): من 5,000 إلى 10,000 دولار أمريكي»). Codes never appear in any text a person
or a model reads; the client's acknowledgment email does not repeat the answers.

## 6. The Pre-meeting Pack

The pack is three artifacts stored as versions in `preparation_drafts`:

| Artifact | Content |
| --- | --- |
| Initial design (`design`) | pattern id, audience, primary goal, information hierarchy, responsive notes, brand context, 2-4 screens (template id + short text slots), user flow |
| Draft proposal (`proposal`) | understanding, recommended solution, first-release scope, phases, deliverables, assumptions, exclusions, what affects cost or schedule, next step. Always shown under *Initial draft for discussion — not a final quote or commitment.* |
| Discovery pack (`discovery`) | client facts (each quoting the brief), assumptions, missing information, questions with their purpose, risks, decisions the client must take, meeting agenda, what to confirm before scope and pricing |

**Automated preparation makes four bounded requests** (`src/lib/pack/steps.ts`), not one:

| Step | Returns | Output ceiling | Becomes |
| --- | --- | --- | --- |
| 1. Analysis | facts (each quoting the brief), assumptions, missing information | 4,000 | part of the discovery pack, and the input of steps 2-4 |
| 2. Design | pattern, blueprint, 2-4 screens, user flow | 6,000 | Initial design |
| 3. Proposal | the draft proposal | 4,000 | Draft proposal |
| 4. Discovery | questions, risks, decisions, agenda, what to confirm | 4,000 | Discovery pack (with step 1) |

Each request carries the sanitised brief (and, after step 1, its checked analysis),
returns one strict JSON object with its own schema, and is validated on its own: unknown
keys, a fact whose evidence is not in the brief, a figure the client did not state, a
promise or guarantee (English or Arabic), a pattern or template outside the library, a
pattern that contradicts the client's project type, fewer than two screens, or a flow
through screens that do not exist are all refused. Each artifact is saved as soon as its
step passes (`pack_save_generated`), so one step failing never discards another.

- **Order and dependence**: the analysis must pass first; design, proposal and discovery
  are independent of each other.
- **Progress** (`inquiry_preparations.pack_progress`): which steps are done or failed, the
  checked analysis and the tokens this run has used. A later attempt repeats only what did
  not finish; the pack finishes (`pack_finish`) when all three artifacts exist.
- **Retries**: only transient failures (timeout, rate limit, provider error, unusable HTTP
  response) are retried automatically, within the job's attempt limit. A cut-off,
  non-JSON or rule-breaking answer is left for a person; a founder's retry keeps the
  finished steps and tries the failed ones again with a fresh per-pack allowance.
- **Caps**: before each request, its worst case (prompt estimate plus its ceiling) is
  checked against the monthly budget and the per-pack cap (`PREPARATION_PACK_TOKEN_CAP`,
  default 30,000). A step that does not fit is not sent.
- **Fallback to a person, never to another model**: if a step fails, that artifact is
  prepared by hand; the other artifacts stay.

The manual Claude path (a founder's own Claude chat) still returns the whole pack as one
object (`src/lib/pack/prompt.ts`) and passes the same checks before it is saved. A brief no
pattern fits gets `pattern: null` and a reason: the design is then made by hand and the pack
shows *Needs manual action*. Each artifact is reviewed and approved separately by the
founder who did not write it; approving a new version supersedes only that artifact's
earlier approval.

## 7. CodeCraft (OpenAI-compatible gateway)

### 7.1 Configuration

- Adapter: `src/lib/preparation/codecraft-generator.ts`; one bounded JSON-mode request per
  step; the key is read only on the server and never logged or returned.
- **The intended generator is Claude through CodeCraft: `claude-sonnet-5`** (set as
  `CODECRAFT_MODEL`). There is exactly one model and no fallback to any other. A reply
  that names a different model is refused and pauses automation (`model_mismatch`).
  `gemini-3.7-flash` was evaluated only as a comparison and is not configured anywhere.
- **Off by default.** Real inquiries also need `CODECRAFT_CLIENT_DATA_APPROVED=true`,
  which is not set anywhere, and must not be until 7.3 is resolved.
- Reasoning budget: `CODECRAFT_REASONING_MAX_TOKENS`, default 1,024, sent as
  `reasoning.max_tokens` (listed in the model's `supported_parameters`, not described in
  CodeCraft's documentation).
- Failure handling: 402, "insufficient / quota / balance / credit / allowance" wording,
  401/403, an unknown model and a different model pause automation (no retry), and the
  pack shows *Needs manual action*; timeouts, 429 (with Retry-After), 5xx and unusable
  HTTP responses are retried; a cut-off or unusable answer is not. The inquiry and the
  booking never wait for any of it.
- **Paid credit**: CodeCraft's terms say that once the monthly allowance is used, requests
  draw on prepaid credit; 402 comes only when both are empty. The app cannot tell
  allowance from credit through the API. Two protections: the app's own monthly limit
  (default 600,000, never above 1,000,000), checked before every request; and the account
  should hold **no prepaid balance**, so an exhausted allowance answers 402 and pauses.
- Audit: the exact sanitised input (brief, prompt version, steps, model, language, project
  type) is stored in `inquiry_preparations.last_payload` and shown on the pack tab. Every
  call's metadata (finish reason, reported usage fields, content and reasoning lengths,
  the model the gateway named, JSON key names reached) is available to the evaluation;
  never content or the key.

### 7.2 Why the single request was cut off (investigation, 10 Oct 2026)

| Question | Finding |
| --- | --- |
| Exact model id from `/v1/models` | `claude-sonnet-5` ("Claude Sonnet 5", "Anthropic balanced model…") |
| Advertised capabilities | reasoning, vision, tools, streaming, json_mode; `supported_parameters` include `reasoning`, `include_reasoning`, `max_tokens`, `response_format` |
| Context window | 1,000,000 (`top_provider.max_completion_tokens`: null) |
| Requested `max_tokens` | 6,000 and 8,192 (first round); 8,192 again in the reproduction |
| Prompt tokens | 1,684 for the single-pack request |
| Completion tokens | 7,182 of 8,192 in the reproduction (it finished this time, `finish_reason: stop`); earlier runs were cut off at 6,000 and 8,192 |
| Finish reason | `length` when cut off; `stop` in the reproduction |
| Did reasoning use the allowance? | Yes, by inference: usage has no reasoning field and no reasoning text is returned, yet a 12-character JSON answer was billed 223-352 completion tokens, and in the staged run two requests used their whole ceiling (4,000 and 6,000) and returned **no content at all**. CodeCraft documents that reasoning tokens count toward `completion_tokens`. |
| Which artifact or schema? | None in particular: the cut-offs happened before any visible output (0 characters), so the size of one section was not the cause. The single pack's visible JSON was about 10,600 characters, roughly a third to half of its completion tokens; the rest was hidden reasoning. |
| Upstream provider identified? | **No.** Every model lists `owned_by: "CodeCraft API"`; responses carry only `id, object, created, model, choices, usage`; no header or field names a provider; the documentation, terms and privacy policy do not name one. The terms say CodeCraft "does not build or host the underlying models". |

### 7.3 Is it Claude?

**Not proven.** The gateway labels the model `claude-sonnet-5` and returns that name, but
nothing shows that the request is served by Anthropic or an authorised Anthropic
reseller. This document therefore says "the model CodeCraft labels `claude-sonnet-5`",
not "Claude". A request costing 300 prompt tokens for a 70-character message (a hidden
system prompt of about 290 tokens) and reasoning that cannot be switched off with
`reasoning.enabled: false` are consistent with a gateway layer but prove nothing either way.
Before `CODECRAFT_CLIENT_DATA_APPROVED` is ever set, CodeCraft should confirm in writing
which provider serves this model and under which data terms.

### 7.4 Evaluation, round 2 (synthetic briefs only, 10 Oct 2026)

All usage below is the provider's reported count. Commands:
`PREPARATION_LIVE_EVAL=1 PREPARATION_GENERATOR=codecraft CODECRAFT_MODEL=claude-sonnet-5 PREPARATION_EVAL_MODE=staged|single … node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/preparation/eval.live.test.ts`
(see the file header). Reports: `review-evidence/claude-*.json` (not committed).

| Run | Request | max_tokens | Prompt | Completion | Total | Finish | Valid | Time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A. Reproduction, single pack (EN) | whole pack | 8,192 | 1,684 | 7,182 | 8,866 | stop | yes, no rule broken | 56.2 s |
| B. Reasoning probes (tiny JSON) | default / effort low / enabled false | 2,048 | 304 each | 297 / 223 / 352 | 601 / 527 / 656 | stop | yes | 10.9 / 4.3 / 3.5 s |
| C. Staged, no reasoning budget (EN) | analysis | 4,000 | 675 | 4,000 | 4,675 | **length, 0 chars** | no | 29.0 s |
| C. Staged, no reasoning budget (AR) | analysis | 4,000 | 706 | 2,582 | 3,288 | stop | yes | 17.1 s |
| | design | 6,000 | 1,597 | 6,000 | 7,597 | **length, 0 chars** | no | 34.2 s |
| | proposal | 4,000 | 973 | 3,422 | 4,395 | stop | yes | 26.0 s |
| | discovery | 4,000 | 976 | 2,917 | 3,893 | stop | yes | 21.2 s |
| D. Probe, reasoning budget 1,024 (EN) | analysis | 4,000 | 675 | 2,792 | 3,467 | stop | yes, 4/4 facts | 17.4 s |
| E. Staged, reasoning budget 1,024 (EN) | analysis | 4,000 | 675 | 3,738 | 4,413 | stop | yes | 24.2 s |
| | design | 6,000 | 1,499 | 3,119 | 4,618 | stop | yes | 24.9 s |
| | proposal | 4,000 | 875 | 3,569 | 4,444 | stop | yes | 33.3 s |
| | discovery | 4,000 | 878 | 2,117 | 2,995 | stop | yes | 19.4 s |
| E. Staged, reasoning budget 1,024 (AR) | analysis | 4,000 | 706 | 2,764 | 3,470 | stop | yes | 19.3 s |
| | design | 6,000 | 1,621 | 4,290 | 5,911 | stop | yes | 35.9 s |
| | proposal | 4,000 | 997 | 3,036 | 4,033 | stop | yes | 28.3 s |
| | discovery | 4,000 | 1,000 | 3,492 | 4,492 | stop | **no: `client_decisions` failed the schema** | 26.6 s |

Totals: A 8,866; B 1,784; C 23,848; D 3,467; E 34,376 (EN pack 16,470, AR pack 17,906).
**Round 2 total: 72,341 tokens**, exact. Round 1 (section 7.5) used 45,352 at most (one
5xx counted at its worst case of 9,111 because no usage was returned); together at most
117,693 on this key, below the app's 600,000 monthly limit.

Final configuration (E): 7 of 8 requests valid; both packs recalled 4 of 4 expected facts;
every fact quoted the brief; no invented price, duration, metric or promise; English design
`scheduling_app` with 4 screens, Arabic design `academy_site` with 4 screens; whole packs
took about 102 s (EN) and 110 s (AR) of sequential requests. The Arabic discovery request
returned a `client_decisions` list that failed the schema (the prompt gave no limit for
that list; it now says "at most 5, each one short sentence"; re-checked and valid in 7.4.1). Under the new
rules that artifact would be prepared by hand and the other two kept.

Quality notes: facts are the brief's own sentences, lightly normalised; assumptions are
plausible and labelled with their reasons (for example "the primary users are patients and
receptionists", "the content will need digitising from the printed booklet"); missing
information and questions are specific and useful for a first meeting. The Arabic is
fluent Modern Standard Arabic suited to a private-school context; one small grammatical
slip ("لم يذكر العميل شعار" for "شعارًا"). A native reader should still review Arabic output
before it is shown to a client.

### 7.4.1 Round 3: the Arabic discovery request re-checked (10 Oct 2026)

After the discovery prompt gained its list limits, only the Arabic discovery request was
re-checked: synthetic Arabic school brief, the model CodeCraft labels `claude-sonnet-5`,
client-data approval off, a run cap of 12,000 tokens and at most two attempts. Reusing the
earlier analysis was tried first and refused before any request (its budget fact quoted
the old label, renamed in this change), so the analysis was asked again. One attempt was
enough.

| Request | max_tokens | Prompt | Completion | Total | Finish | Valid | Time |
| --- | --- | --- | --- | --- | --- | --- | --- |
| analysis | 4,000 | 709 | 2,650 | 3,359 | stop | yes, 4/4 expected facts, every fact quotes the brief | 18.4 s |
| discovery | 4,000 | 999 | 2,354 | 3,353 | stop | **yes** | 17.4 s |

**Round 3 total: 6,712 tokens**, exact. The decisions list that failed before now has 5
items of 28-41 characters (schema: at most 6, each at most 200). The Arabic has no
grammatical errors; two words omit the optional tanween alif ("قديما", "مبكرا") and one
phrase is less formal than it could be ("نحتاج لتوفيرها" for "نحتاج إلى توفيرها"). With this,
all eight artifacts of the final evaluation are valid: the four English requests and the
Arabic analysis, design and proposal of round 2 (run E), and this Arabic discovery request.

**CodeCraft consumption on this key**: round 1 at most 45,352; round 2 exactly 72,341;
round 3 exactly 6,712; **at most 124,405 in total** (79,053 of it exact), below the app's
600,000 monthly limit.

### 7.5 Comparison: `gemini-3.7-flash` (round 1, single request; not configured)

| Brief | Result | Prompt | Completion | Total | Time |
| --- | --- | --- | --- | --- | --- |
| English clinic | valid, 4/4 facts, `scheduling_app` | 1,678 | 4,461 | 6,139 | 28.3 s |
| Arabic school | valid, 4/4 facts, `academy_site` | 1,709 | 7,701 | 9,410 | 34.8 s |

Gemini produced a whole valid pack in one request with less hidden reasoning; it was not
re-run in the staged form. It is kept only as a comparison: it is not the intended
generator and never receives anything after a Claude-labelled request fails. Its upstream
provider is equally unidentified.

### 7.6 Live evaluation and the normal test suite

The normal suite (`npm test`) reports 2 skipped tests, both intentional:

1. `src/lib/preparation/eval.live.test.ts`: the live evaluation above. It runs only with
   `PREPARATION_LIVE_EVAL=1` and a configured CodeCraft model and key; it refuses to start
   if `CODECRAFT_CLIENT_DATA_APPROVED=true`; it sends only `SYNTHETIC_BRIEFS`; it stops
   before any request whose worst case would pass `PREPARATION_EVAL_MAX_TOKENS`. Normal
   runs and CI never set these variables and have no key, so they cannot spend tokens.
2. `src/content/work-screens.test.ts`: a public-site test (on `main` since 4 Oct) that
   waits until case-study screenshots exist; unrelated to the CRM.

### 7.7 Real-client restriction

- **CodeCraft has not identified the upstream provider** of any model: not in `/v1/models`
  (`owned_by: "CodeCraft API"`), not in responses, not in its documentation, terms or
  privacy policy.
- The model is therefore described everywhere as **"the model CodeCraft labels
  `claude-sonnet-5`"**, not as Claude.
- **No production client brief may be sent** until Mintapp has acceptable written
  confirmation from CodeCraft of the provider serving that model and of the
  data-processing terms. Enforced in code: `selectGenerator` refuses real inquiries unless
  `CODECRAFT_CLIENT_DATA_APPROVED=true` (unit-tested), which is set nowhere, and automated
  preparation is off unless `PREPARATION_GENERATOR` is set. The local `.env.local` holds
  only the key; the Vercel environment variables were not inspected or changed.
- **The manual Claude Pro path remains the real-client fallback**: a founder copies the
  scrubbed prompt into their own Claude chat and pastes the reply back, where it passes
  the same checks. No Claude Pro account is connected to the application.
- **`gemini-3.7-flash` remains unconfigured** and cannot be selected automatically: there
  is exactly one configured model, no fallback setting, and a reply naming any other model
  is refused and pauses automation.

## 8. The interface

| Address | What it is |
| --- | --- |
| `/dashboard` | The command centre (`crm_command_centre`). Alerts (actions with no owner, packs that stopped, paused automation, a meeting within 48 hours without an approved pack), actions grouped overdue / today / this week with one owner each, upcoming meetings (Cairo time, the client's time when different, the Cal.com manage link), packs waiting for review, leads waiting for a response, who is doing what, active projects, a small Growth snapshot. Every empty section is hidden; no KPI grid, no technical status names. Meetings, preparation, client and Growth items carry a labelled badge and a coloured edge. |
| `/leads` | Leads & Clients (`lead_list`): client and company, project type and brief excerpt, meeting, pack state, position, priority, paused flag, owner, next action and date. Filters: text, owner, position (seven steps), priority, paused. No email or phone in the list. |
| `/leads/<id>` | Overview: client and idea, budget, timeline and existing link (shown, never fetched), meeting, communication notes, position (seven steps, a loss needs its reason), priority, pause with a date to look again, owner, next actions (an automatic review with no owner can be assigned in place), contact details collapsed, and an **Advanced** area (collapsed) with source, attribution, the optional seven-part score, and the company and contact link. |
| `/leads/<id>/pack` | The Pre-meeting Pack: its state and why, the review action and its deadline ("I will review it"), Prepare now (only when automation is on), Prepare by hand, Resume automation; the three artifacts, each with its versions, source (automated, written by hand, edited by hand), review buttons, an edit-as-text form (always a new version) and, for a library design, the design data as JSON (accepted only if it is still a library design); the manual Claude prompt with copy, the paste-back form; the sanitised input last sent to the AI service; older single notes. |
| `/leads/<id>/pack/design?v=N` | The internal preview of one design version (noindex). |
| `/leads/<id>/deal` | The final proposal (versioned, approved by the other founder, recorded as sent and accepted by hand), the contract (status, signed date, reference: no e-signature), commercial notes, and the project once won. |
| `/leads/<id>/activity` | The trail: stage changes, bookings, reviews, contract, priority, pause. |
| `/growth` | Prospects by priority (`growth_prospect_list`) with owner, reason now, history, next action and source; current numbers; the six-field quick form with research collapsed. A prospect's own page stays at `/outreach/<id>`, under Growth in the navigation. |
| `/projects` | Won work, unchanged and simple: no controls that do nothing. |
| `/settings` | Default reviewer, automation status (on/off, model, paused providers with Resume), links to companies and exports. |
| `/inquiries`, `/inquiries/<id>`, `/pipeline`, `/proposals` | Redirect to `/leads`, the lead, `/leads`, and `/leads?stage=proposal`. `/metrics` and `/companies` stay, reached from Growth and More. |

Positions map onto the stored stages without migrating them: New `new`; Reviewing
`reviewing` (and the legacy `paused`); Meeting `meeting_booked`, `preparing`,
`meeting_ready`, `meeting_completed`; Qualified `qualified`; Proposal `proposal_prep`,
`proposal_sent`; Decision `negotiation`; Won `won`; Lost `lost`
(`src/lib/crm/simple-stages.ts`). Choosing the step a lead is already in writes
nothing, so a detailed value is never overwritten.

## 9. The renderer and the pattern library

- `src/lib/pack/patterns.ts`: 11 patterns (5 websites, 5 web apps, 1 mobile app) built
  from 23 templates; each pattern lists its templates and each template its maximum
  number of items.
- `src/lib/pack/foundations.ts`: type, spacing, grid, colour, radius, shadow; motion is
  none, so reduced motion needs nothing special.
- `src/components/pack/templates.tsx`: one trusted React component per template id. A
  model's text is only ever rendered as text (React escapes it); no HTML injection, no
  `eval`, no external asset, images are labelled placeholders (`aria-hidden`).
- `src/components/pack/DesignPreview.tsx`: device frames (desktop and phone; phone only
  for a mobile pattern), the user flow, the blueprint notes; the design's own language
  sets its direction (an Arabic design is drawn right to left).
- Before drawing, a stored design is checked again (`renderableDesign`): anything that is
  not a library pattern with its own templates is not drawn. A design no pattern fits is
  shown as notes, and the pack asks for a hand-made design.
- **Design library** (`/settings/design-library`, internal, noindex): the inventory below
  and six synthetic examples drawn by the same templates (`src/lib/pack/examples.ts`):
  service website (`studio_site`), marketplace (`marketplace_site`), operations dashboard
  (`operations_app`), booking application (`scheduling_app`), mobile application
  (`mobile_app`) and an Arabic right-to-left website (`academy_site`). They need no
  database and no AI call, so any admin Preview shows them.

### 9.1 Patterns

Every pattern has an English and an Arabic name, and every template draws text in either
language (direction follows the design's language). Website and web-application patterns
are drawn in a desktop frame and a phone frame; the mobile pattern in phone frames only.

| Pattern | Category | Intended use | Screens / sections it may render (2-4 chosen) |
| --- | --- | --- | --- |
| `studio_site` | Website | a company presenting its services and taking inquiries | hero, value_points, services, how_it_works, proof, faq, contact_cta |
| `saas_marketing` | Website | a software product explaining its value and converting sign-ups | hero, value_points, how_it_works, proof, faq, contact_cta |
| `marketplace_site` | Website | listings from many providers that visitors browse and request | hero, catalogue, how_it_works, proof, faq, contact_cta |
| `academy_site` | Website | courses or programmes that learners browse and apply to | hero, course_list, how_it_works, proof, faq, contact_cta |
| `booking_site` | Website | a local service business where visitors choose a service and book a time | hero, services, booking_form, how_it_works, faq, contact_cta |
| `dashboard_app` | Web app | people who monitor activity and act on what needs attention | overview_dashboard, record_table, record_detail, data_form |
| `operations_app` | Web app | a team moving requests or jobs through stages | workflow_board, record_table, record_detail, data_form, overview_dashboard |
| `marketplace_admin` | Web app | operators who manage providers, listings and orders | overview_dashboard, record_table, record_detail, catalogue, data_form |
| `crm_app` | Web app | a team tracking customers or cases and the next action on each | record_table, record_detail, workflow_board, data_form, overview_dashboard |
| `scheduling_app` | Web app | staff and customers booking and managing appointments | schedule_calendar, booking_form, record_table, record_detail, how_it_works |
| `mobile_app` | Mobile app | onboarding, a home, finding things, booking or ordering, tracking and a profile | onboarding, home, list_search, detail, booking_order, tracking, profile |

### 9.2 Templates

| Template | Renders | Items at most | Used by |
| --- | --- | --- | --- |
| `hero` | headline, supporting text, actions, image placeholder, optional cards | 3 | websites |
| `value_points` | heading and 3-4 cards | 4 | websites |
| `services` | heading and service cards | 6 | websites |
| `how_it_works` | heading and numbered steps | 5 | websites, web apps |
| `catalogue` | heading and listing cards with image placeholders | 6 | websites, web apps |
| `course_list` | the catalogue layout for courses or programmes | 6 | websites |
| `booking_form` | heading and a form of labelled fields with actions | 6 | websites, web apps |
| `proof` | heading and two-column cards for proof points (figures only if the client stated them) | 3 | websites |
| `faq` | heading and question rows | 5 | websites |
| `contact_cta` | a closing call to action | 2 | websites |
| `overview_dashboard` | app frame, heading and tiles whose values are drawn as placeholders | 6 | web apps |
| `record_table` | app frame, heading and record rows | 6 | web apps |
| `record_detail` | app frame, fields and an image placeholder | 6 | web apps |
| `workflow_board` | app frame and stage columns | 5 | web apps |
| `schedule_calendar` | app frame, a calendar grid and the day's rows | 6 | web apps |
| `data_form` | app frame and a form | 6 | web apps |
| `onboarding` | image placeholder, headline, points, action | 3 | mobile |
| `home` | headline, image placeholder, cards, action | 4 | mobile |
| `list_search` | headline, search field, rows | 6 | mobile |
| `detail` | image placeholder, headline, rows, action | 5 | mobile |
| `booking_order` | the booking form in a phone | 5 | mobile |
| `tracking` | a vertical progress timeline | 5 | mobile |
| `profile` | avatar placeholder, headline, rows | 5 | mobile |

### 9.3 When the design is prepared by hand

- The brief fits no pattern (for example a game, a social feed, live chat, maps, video,
  hardware or an integration-only project): the design step returns `pattern: null` with a
  reason.
- The chosen pattern does not match the client's project type, or a screen uses a template
  outside its pattern: the step is refused.
- The design request is cut off, unusable or breaks a rule: nothing is saved for the
  design; the proposal and discovery pack are kept.
- A project that needs more than one product (a website and an app): one pattern is drawn;
  the rest is written by hand.
- A stored design that fails the library check again is not drawn.

## 10. Privacy: what can reach an AI service

| Data | Sent? |
| --- | --- |
| Project description | yes, after `scrubContactDetails` removes emails, links, domains, handles, phone numbers and the inquiry's own name, company, email, phone and link wherever they appear |
| Project type, budget, timeline, country | yes, as the client chose them |
| Name, email, phone, company, existing link, referral and tracking fields | never |
| Notes, owners, CRM data | never |

Automated preparation sends four requests per pack; each carries the same scrubbed brief,
and steps 2-4 also carry the analysis checked against it. The manual prompt is built from
the same scrubbed brief. Proof: `src/lib/preparation/scrub.test.ts` runs a whole pack through
the real CodeCraft adapter with a network double and checks all four request bodies and
the audit payload for the client's name, company, email, phone and link;
`preparation.test.ts` checks the brief; the browser tests assert
the copied prompt contains the brief and none of the client's contact details
(`tests/dashboard/dashboard.spec.ts`, `leads.spec.ts`, `tests/review/crm-live.spec.ts`).
The exact payload of the last automated run is stored (`last_payload`, at most 40,000
characters) and shown on the pack tab. No key is stored or shown. Real inquiries reach
CodeCraft only with `CODECRAFT_CLIENT_DATA_APPROVED=true`, which is not set anywhere;
the existing link is never fetched by any code.

## 11. Failure and recovery

| What happens | What the founders see | What to do |
| --- | --- | --- |
| Automation off (default) | *Needs manual action*: automated preparation is turned off | Prepare by hand with the Claude prompt |
| CodeCraft 402, quota or allowance wording, bad key, unknown model | Automation paused for every lead; *Needs manual action*; a dashboard alert | Prepare by hand; resume in Settings once fixed. No paid fallback (keep no prepaid balance on the account: section 7.1) |
| Timeout, 429, 5xx, unusable HTTP response | That step is retried later (the job's attempt limit, at most 3); finished steps are kept | Nothing, or prepare by hand |
| One step cut off, non-JSON or breaking a rule (invented figure, ungrounded fact, wrong language, promise, wrong pattern) | That artifact is not saved; the other two are; *Needs manual action* | Write that artifact by hand, or retry (finished steps are kept) |
| The reply names a different model | Not saved; automation paused; dashboard alert | Check the gateway; resume in Settings |
| A step would pass the per-pack cap or the monthly budget | Not sent; that artifact by hand (pack cap) or automation paused (monthly) | Prepare by hand; raise a cap only deliberately |
| No pattern fits the project | The design is notes only; *Needs manual action* | Write the design by hand on the pack tab |
| Booking rescheduled | Review deadline moves | Nothing |
| Booking cancelled | Meeting *Cancelled*; the review action closes; every version stays | Nothing; a new booking creates a new action |
| Review deadline passed, pack not approved | *Needs attention*; dashboard alert within 48 hours of the meeting | Review and approve, or reassign |
| An automatic review action with no owner | *Needs an owner* on the lead, the list and the dashboard | Assign it, or set the default reviewer in Settings |

The public form, the booking page, the acknowledgment email and the Cal.com webhook
never wait for preparation: the booking trigger catches its own errors, and the webhook
starts the worker only after it has answered.

## 12. Migrations, order and rollback

Both migrations are additive and forward-only, and are **not applied anywhere** by this
branch. In this order, after code review:

1. `supabase/migrations/20261015000000_add_two_founder_workflow.sql`
2. `supabase/migrations/20261016000000_add_two_founder_reads.sql`

On the synthetic review project (`mintapp-review`), which already has every migration up
to `20261014000000_add_crm_reads.sql`, apply exactly these two, in this order, then run
`npm run review:verify` and `npm run test:review-live`. Production (`main`) stops at
`20261007000000`; it needs, in file order, `20261005000000`, `20261006000000`,
`20261010000000` to `20261014000000` (preparation, admin sign-in, CRM Release 1), then
the two above. `20261005000000` sorts before `20261007000000`, which production already
has; the two do not touch the same objects. The
production-upgrade test (`tests/db/production-upgrade.test.mjs`) applies them on a copy
of the production schema with data and checks nothing is lost.

They also add `inquiry_preparations.pack_progress` and the step functions
(`pack_save_generated`, `pack_progress_get`, `pack_progress_set`, `pack_finish`).

What they change in existing data: queued jobs for inquiries without a booking become
`waiting_booking`; existing drafts get `artifact = 'note'`; every booked future meeting
gets its review action. Nothing is deleted.

Rollback (recovery only, owner's go-ahead, export first):
`supabase/rollback/04_remove_two_founder_workflow.sql` removes both migrations in one
transaction and restores the CRM Release 1 definitions; then, only if CRM Release 1 must
go too, `03_remove_crm_release_1.sql`, and so on. The test above applies all migrations,
rolls back 04, 03 and 02, and applies everything again. The booking-ledger migration is
not part of this branch.

## 13. Tests

| Suite | Command | Result (10 Oct 2026, after the staged-generation change) |
| --- | --- | --- |
| Types, lint, whitespace | `npx tsc --noEmit`, `npx eslint src tests scripts`, `git diff --check` | clean |
| Unit | `npm test` | 668 passed, 2 skipped (both intentional: section 7.6) |
| Database | `npm run test:db` | 152 passed |
| Public browser | `npx playwright test --workers=2` | 341 passed, 1 failed: `semantic-navigation.spec.ts` "ar … in-page hash navigation still scrolls to the section" is intermittent and fails the same way on the base `feat/crm-release-1` (2 of 3 repeats on both); not caused by this branch |
| Admin browser | `npm run test:dashboard` | 59 passed: dashboard 13, CRM 21, two-founder workflow 15, sign-in 10 (on a busy machine one run hit `spawn UNKNOWN` from the local demo database; the re-run passed) |
| Builds | `npm run test:build` | public and admin builds, 7 passed |
| Audit | `npm audit --omit=dev` | 0 vulnerabilities |
| Live CodeCraft evaluation | see section 7.4 | run on synthetic briefs only; results above |
| Live review | `npm run test:review-live` | not run: needs the two migrations on the review project |

Running the database tests and the browser suites at the same time exhausts this
machine's processes (`spawn UNKNOWN`) and, with 8 browser workers, its memory; run them
one at a time.

## 14. Deferred

- **Release 2:** hours per project (the dashboard has no hours section until then);
  CSV import of campaign numbers; editing the budget bands without a deploy; reminders
  by email for review deadlines.
- **Release 3:** richer design templates and brand context from approved assets;
  generation of the final proposal from the approved draft; any social-platform
  integration (none now: campaign figures are entered or imported by hand).
