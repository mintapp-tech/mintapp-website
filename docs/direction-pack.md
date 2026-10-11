# The structured Pack and the Direction Pack (technical design)

Built on `feat/two-founder-crm` on 11 Oct 2026. What existed before is recorded in
`docs/pre-meeting-pack-audit.md`. No migration was needed: everything below uses the
existing versioned drafts (`preparation_drafts`) and functions.

## 1. One source of truth

The Pack is one strict, versioned structure (`src/lib/pack/schema.ts`, format 2). The
presentation and its PDF are only renderings of an approved version.

| Working area (stored artifact) | Sections |
| --- | --- |
| Initial product direction (`design`) | client_facts, assumptions, missing_information, business_context, users, problem, goals, design_blueprint, screens, user_flow |
| Draft scope and proposal direction (`proposal`) | scope_direction, proposal_direction |
| Discovery and meeting plan (`discovery`) | discovery_questions, decisions_needed, risks, meeting_agenda, next_steps |

Every statement has one basis (`classifyPack`): a **client fact** (an exact quote from
the brief is required), a Mintapp **assumption**, a Mintapp **recommendation**, or a
**question** to confirm. Business context, users, problem and goals carry the basis on
each statement; the other sections have a fixed basis (risks are assumptions; agenda,
scope, proposal and design are recommendations; missing information, questions and
decisions are questions).

**Refused (nothing is saved):** wrong structure or unknown keys; wrong language or
script; a client fact (or a statement marked as one) that does not quote the brief; any
figure the client did not state; a promise, fixed price or delivery date anywhere,
assumptions included; endorsements, awards or superlatives; markup, links, email
addresses; a pattern, template, proposal pattern or discovery bank outside the library;
a pattern or proposal pattern that contradicts the client's project type; fewer than two
screens or a broken journey.

**Saved but never presented:** placeholder text (`[MOCK]`, TBD, lorem ipsum), a design no
library pattern fits, and versions in the older format (still readable in history).

The same checks run for automation (four bounded steps, `steps.ts`, prompt version
`pack-steps-v2`), the manual Claude paste (`validatePack`), the structured editor and the
local checker (`validateArtifact`), and again before presenting.

## 2. Working on a Pack (`/leads/<id>/pack`)

Each working area shows its latest version as sections with basis labels (Client said,
Our assumption, Our recommendation, To confirm), its origin (automated, written by hand,
edited by hand), author, reviewer, the checks (passed, or the rule broken) and findings
for the reviewer, and what changed since the previous version. **Editing** is a form of
labelled fields per section (no free text, no JSON): saving builds the structured version
and checks it; a refused edit keeps everything typed and lists the reasons. **Approval**
is by the founder who did not write the version, after ticking the approval checklist
(checked in the page and in the server action).

## 3. The Direction Pack (`/present/<id>`)

A full-screen 16:9 presentation drawn only by trusted components
(`src/components/pack/DirectionPack.tsx`) from the **approved** version of each part
(`src/lib/pack/presentation.ts`); a newer draft never leaks in, and the approved versions
are re-checked against the brief. Slides (`src/lib/pack/slides.ts`): cover; what we
understood; users and goals; facts and assumptions; initial product direction; one slide
per concept screen (2-4, desktop and phone frames); the main journey; recommended first
release; the indicative proposal direction (always under "not a quote or a commitment");
open questions and decisions; risks; agenda and next steps. Long lists continue on
another slide instead of being clipped; concept frames are scaled to fit.

- English and Arabic (right to left), in the Pack's own language; the version (for
  example 4.2.3) and the approval date are on the cover and every footer.
- Keyboard: arrows (direction-aware), Page Up/Down, Home, End; full screen.
- Static: identical with reduced motion. On phones the slides become a reading column.
- Private: signed-in founders only, `noindex`, `private, no-store`.
- **Export**: the browser's own print-to-PDF, one page per slide at 16:9 or on A4
  landscape, offered only for an approved Pack. `?mode=preview` shows the latest versions
  to the founders, watermarked, and prints only a notice.

The final proposal and Scope of Work stay on the Deal tab, written after discovery,
with their own versions and approval. The Pack never carries a price or a timeline.

## 4. The design library (`src/lib/pack/library/`, `/settings/design-library`)

Foundations with written rules (10), components (13), product patterns (12), screen
templates (26), proposal patterns (4), discovery banks (12), quality rules (9), the
review rubric (10) and the approval checklist (7). One synthetic example per product
pattern. The library is the one catalogue automation, the editor, the manual prompt and
the rules for Claude use; the first library's `operations_app` and `mobile_app` stay
drawable in history only.

## 5. Manual preparation with Claude

`docs/pack-rules/` (README written by hand; `library.md`, `instructions.md` and
`pack.schema.json` generated by `npm run pack:rules`, kept in step by a test).
`npm run pack:workspace` creates a private workspace outside the repository;
`npm run pack:check` runs the application's validator on its draft; the Pack is imported
by pasting it on the Pack tab.

## 6. The review environment

`supabase/review/` (never migrations; each file refuses any database whose
`review_environment()` is not `synthetic-review`): `review_tools.sql` (`review_purge`, a
dry run unless applied; `review_delete`) and `seed_curated.sql` (generated by
`npm run review:seed`). Owner steps: `supabase/review/README.md`. The live tests keep their
run tag in hidden fields (`<tag>-en@review-run.invalid`, `review-<tag>`) with readable
names, clear older leftovers when they start and remove their own run when they finish
(or, before the tools are installed, soft-delete and archive their own rows).

## 7. Cost

No new service or dependency: React rendering, CSS print rules and the browser's own
PDF. Nothing generated is stored as a file; PDFs are saved by the founder.

## 8. Tests

`src/lib/pack/*.test.ts` (schema, classification, editor, readiness, slides, rules),
`src/lib/review-seed/seed.test.ts`, `tests/db/review-tools.test.mjs`,
`tests/scripts/client-workspace.test.mjs`, `tests/dashboard/direction-pack.spec.ts` (the
curated seed, presentation, 16:9 and A4 PDFs, longest content in both languages, phones,
reduced motion, accessibility), and the updated admin and live suites.
