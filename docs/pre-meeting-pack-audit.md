# Pre-meeting Pack: audit before the Direction Pack (11 Oct 2026)

What genuinely existed on `feat/two-founder-crm` at `42c58dc`, read from the code before
any change in this round. Nothing here is planned work; the gaps are listed at the end.

## 1. Stored artifacts and versioning

- Table `preparation_drafts` (migrations 05, 06, 15): one row per version, numbered per
  inquiry across all artifacts (`unique (inquiry_id, version)`), with `artifact`
  (`note`, `design`, `proposal`, `discovery`), `content jsonb` (must be an object),
  `source` (`mock`, `codecraft`, `manual`, `edited`), `model`, `created_by`,
  `review_status` (`draft`, `in_review`, `approved`, `superseded`), `reviewed_by`,
  `reviewed_at`.
- Writes: `pack_save_generated` (worker, only while it holds the job),
  `pack_save_artifact` and `pack_save_all` (a founder's version; hands the job to manual).
  Every save is a new version; nothing is edited in place.
- `dashboard_review` (redefined in 15): draft → in review → approved, in review → draft
  (sent back), approved → draft (withdrawn). Approving supersedes only the same
  artifact's earlier approval.
- `pack_latest(inquiry)` (16): the latest version of each artifact, with an `unsupported`
  flag for a generated design with `pattern: null`.
- Stored content formats (`src/lib/pack/schema.ts`, `PACK_FORMAT_VERSION = 1`):
  `pack-design` (blueprint, screens, user flow), `pack-proposal` (understanding,
  solution, scope, phases, deliverables, assumptions, exclusions, cost/schedule factors,
  next step), `pack-discovery` (client facts, assumptions, missing information,
  questions, risks, client decisions, agenda, confirm-before-pricing), and `text` (a
  founder's free-text edit).

## 2. The Pack tab (`/leads/<id>/pack`)

- State in plain language (`src/lib/pack/state.ts`): not started, preparing, needs
  manual action (with the reason), ready for review, approved, needs attention (review
  overdue).
- The review action with its owner and due date, "I will review it", Prepare now
  (automation on only), Prepare by hand, Resume automation.
- One card per artifact: version and review chips, source and author, the content as
  headed sections, "Open the design preview" for a renderable design, review buttons,
  history of earlier versions (each expandable).
- **Editing**: "Edit as text" saves a new version in format `text` (free text, no
  structure, no validation beyond length); a library design can also be edited as raw
  JSON (re-checked by `renderableDesign`).
- The manual Claude path: the prompt (brief only, contact details removed) with copy;
  the paste-back form runs the same validator as automation and saves three versions.
- The sanitised input last sent to an AI service; older single notes.
- Approval: only the founder who did not write a version may approve it
  (`mayApproveArtifact`, enforced in the page and in `packReviewAction`); automation
  versions may be approved by either founder.

## 3. What the "initial design" actually renders

`/leads/<id>/pack/design?v=N` (internal, noindex) draws one version of a `pack-design`
artifact with `DesignPreview`: a "not final" banner, the pattern name, audience, goal,
brand context, hierarchy, responsive notes, the user flow as a row of chips, and each
screen in a desktop and a phone frame (phone only for the mobile pattern). Screens are
drawn by trusted React templates from short text slots; images are labelled grey
placeholders; no model markup, style or asset is ever used. A stored design is checked
again before drawing (`renderableDesign`); a design no pattern fits is not drawn.

It is a review aid for the founders. It is not a client presentation: it has no cover,
no narrative, no 16:9 layout, no print styles, and it shows internal notes.

## 4. Patterns (11) and templates (23)

`src/lib/pack/patterns.ts`:

| Pattern | Kind | Templates |
| --- | --- | --- |
| `studio_site` | website | hero, value_points, services, how_it_works, proof, faq, contact_cta |
| `saas_marketing` | website | hero, value_points, how_it_works, proof, faq, contact_cta |
| `marketplace_site` | website | hero, catalogue, how_it_works, proof, faq, contact_cta |
| `academy_site` | website | hero, course_list, how_it_works, proof, faq, contact_cta |
| `booking_site` | website | hero, services, booking_form, how_it_works, faq, contact_cta |
| `dashboard_app` | web app | overview_dashboard, record_table, record_detail, data_form |
| `operations_app` | web app | workflow_board, record_table, record_detail, data_form, overview_dashboard |
| `marketplace_admin` | web app | overview_dashboard, record_table, record_detail, catalogue, data_form |
| `crm_app` | web app | record_table, record_detail, workflow_board, data_form, overview_dashboard |
| `scheduling_app` | web app | schedule_calendar, booking_form, record_table, record_detail, how_it_works |
| `mobile_app` | mobile app | onboarding, home, list_search, detail, booking_order, tracking, profile |

Templates (with their item limits): hero 3, value_points 4, services 6, how_it_works 5,
catalogue 6, course_list 6, booking_form 6, proof 3, faq 5, contact_cta 2,
overview_dashboard 6, record_table 6, record_detail 6, workflow_board 5,
schedule_calendar 6, data_form 6, onboarding 3, home 4, list_search 6, detail 5,
booking_order 5, tracking 5, profile 5. Each maps to one component in
`src/components/pack/templates.tsx`, built from internal parts (Cards, Rows, Steps,
Fields, AppChrome, Placeholder, Actions).

Foundations (`src/lib/pack/foundations.ts`): one type scale, 4px spacing, a 12/4 column
grid, ink/paper colours with one accent, radius and shadow tokens, no motion. There is no
written guidance on imagery, components, accessibility review or Arabic review, no
proposal patterns, no discovery banks and no quality rubric.

The design library page (`/settings/design-library`) shows six synthetic example designs
(`src/lib/pack/examples.ts`) and tables of the patterns and templates.

## 5. Proposal and discovery structures

- Draft proposal: free prose fields plus lists (above). No proposal pattern, no link to
  the kind of project; "assumptions" inside the proposal are not separated from
  recommendations. Always labelled "Initial draft for discussion — not a final quote".
- Discovery pack: questions with a purpose, but no topic (bank) and no check that the
  questions cover users, payments, roles, content, security and so on.
- Client facts must quote the brief; assumptions carry a reason. Business context,
  users, problem and goals are not separate sections: the proposal's "understanding" is
  one paragraph that mixes them, with no statement-level basis.

## 6. Validation that existed

`validatePack` / `validateStep`: strict shape (unknown keys refused), language, every
fact's evidence must be a quote from the brief, no figure the client did not state
(prices, dates, durations, quantities, metrics), no promise or guarantee (English and
Arabic), library pattern and templates only, the pattern must match the client's
project type, 2 to 4 screens, a flow of at least two steps through existing screens.
Free-text edits (`text` versions) bypass all of these.

## 7. What can be presented to a client today

Nothing is client-facing. Every Pack surface is inside the authenticated admin
application and carries internal notes (sources, review chips, the AI payload). The
public `/internal/concept-pack` page is an older static concept page (noindex), not
connected to any lead or Pack.

## 8. What can be exported today

CSV exports from `/export/<kind>` (inquiries, companies, contacts, prospects): lead
fields, budget and timeline labels, stage, owners, next action. No Pack content, no
presentation, no PDF.

## 9. The final proposal

`crm_proposals` (migration 12, the Deal tab): versioned, with summary, scope,
deliverables, exclusions, assumptions, weeks min/max, price min/max and currency,
approved by the other founder, recorded as sent and accepted by hand. It is separate
from the Pack and is written after discovery.

## 10. What was missing compared with the required system

- One Pack structure with the seventeen named sections and a basis (client fact,
  assumption, recommendation, question) for every statement.
- Structured editing: edits became free text and lost all checks.
- Validation findings shown to the reviewer; comparison with the previous version.
- A client-facing Direction Pack: a 16:9 presentation in English and Arabic, built only
  from approved versions, with print-to-PDF export after approval.
- A canonical design library with foundations, components, twelve product patterns
  (the three mobile patterns were one), proposal patterns, discovery banks, quality
  rules and a review rubric, shared by automation and manual preparation.
- A rules area for the manual Claude workflow, and a private client-workspace
  convention outside the repository.
- A guarded review-only cleanup and a readable curated review dataset; live tests left
  their rows behind with timestamps in visible names.
