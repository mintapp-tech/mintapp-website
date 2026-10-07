# Admin application and CRM roadmap

The private admin application becomes Mintapp's internal CRM over time. Each
phase ships on its own, with the same sign-in, server-side checks and tests.

## This release: inquiries and meeting preparation

- **Intake:** inquiries from the Start Project form, in English and Arabic.
- **Booking status:** meeting booked, rescheduled, cancelled (from Cal.com).
- **Preparation:** a structured brief copied into the team's own Claude Pro
  chat and pasted back (CodeCraft stays off for real inquiries).
- **Review:** draft versions, marked ready by one person and approved by the
  other.
- **Ownership:** Omar, Adam, or Omar & Adam.
- **Notes** for the team.
- **Follow-ups:** each with one responsible person, a due date and an open or
  done state; overdue items stand out in the list and are counted.
- **Four separate states** per inquiry: meeting, preparation, review, and sales
  stage (shown; changing it is a later step).
- **Teammate approval:** nobody approves a preparation note they wrote.
- **English and Arabic**, right to left, desktop and phone.

Not in v1, on purpose: contacts and companies, proposals, projects, hours,
delivery, support, any GitHub connection, any automated preparation (CodeCraft
stays off), invoices or payments.

## How v1 extends without rewriting the inquiry workflow

The inquiry stays the root record. Everything v1 added hangs off its id, and
each later module is a new migration and new routes, never a change to what
exists:

- **Keys.** Notes, follow-ups, drafts and preparation jobs are keyed by
  `inquiry_id`. People are member ids (`omar`, `adam`), never emails. These do
  not change.
- **Contacts and companies** add two tables and one nullable `contact_id` on
  `project_inquiries`. Existing inquiries keep working with it empty; a person
  or team links or merges them later, and repeat inquiries join the same contact.
  The inquiry list and detail pages gain a contact link, nothing else changes.
- **Proposals** reference an inquiry and the *approved* draft version
  (`inquiry_id`, `draft_version`), so the review step v1 built is the gate to
  proposing. Versions and states are their own table.
- **Projects and milestones** reference the accepted proposal; follow-ups gain
  nullable `project_id` / `milestone_id` columns, so the same "one responsible
  person, one due date" rule covers project work with no new concept.
- **The sales stage** (`lead_status`, already stored and shown) becomes editable
  with one new database function, with the same server-side checks as every
  other action.
- **Navigation.** The shell grows a menu (Inquiries, Contacts, Proposals,
  Projects); `/inquiries` and `/inquiries/[id]` keep their addresses.
- **Same rules for every module:** server-side allowlist and MFA check on every
  page and action, `service_role`-only functions, row-level security, tests for
  the database function and the browser flow, English and Arabic, and a
  rehearsal like `tests/db/production-upgrade.test.mjs` before it reaches
  production.

The one known scaling limit: the inquiry list loads everything (about 190 ms and
3 MB at 5,000 inquiries). Filters and paging come before it becomes slow, not
after.

## Later phases

1. **Contacts and companies.** One record per person and company, with the
   history of their inquiries, meetings, notes and follow-ups. Repeat
   inquiries join the existing contact.
2. **Proposals and approved scope.** A proposal built from the approved
   preparation note, with versions and a sent, accepted or declined state.
   Prices and scope are entered by the team only. The accepted version
   becomes the approved scope.
3. **Projects and milestones.** An accepted proposal becomes a project with
   milestones, dates and an owner, linked back to the contact and the scope.
4. **Actual hours.** Time entries by Omar and Adam per project and milestone,
   with weekly totals compared with the estimate in the approved scope.
5. **Delivery and handover.** Release records, the handover checklist
   (accounts, credentials transferred through the client's own vault,
   documentation) and client sign-off.
6. **Support.** Requests after handover, response times and any support
   agreement, linked to the project.

## Development tasks come from GitHub

Development work is tracked in GitHub issues on the project's repositories.
When this integration is built, the CRM **reads** issues, their state and
their GitHub assignees from the connected repositories and shows them next to
the project and milestone. It never keeps its own copy of task assignments:
GitHub stays the single source of truth for who is doing which development
task, and the CRM links out to it. CRM-only work (follow-ups, proposals,
support requests) keeps its own responsible person.

### The intended read-only view (not built; no token, no connection yet)

On a project (and its milestones), a list of the linked repositories' issues,
each showing only what GitHub says:

| Shown | Source |
| --- | --- |
| Repository | the connected repository's name |
| Issue title and number | GitHub, as `#123 Title` |
| Status | GitHub (open, closed, and the linked pull request's state) |
| Labels | GitHub labels |
| Assignee | the GitHub assignee, shown as GitHub shows it |
| Link | opens the issue on GitHub |

Rules for when it is built: read-only (no creating, editing, assigning or
commenting from the CRM); a fine-grained token with read access to issues and pull
requests on the named repositories only, stored in the Operations project's
server-side settings and never in the browser; fetched on the server and cached
briefly; GitHub being unreachable shows a notice, never a stale value presented as
current; issues are never copied into CRM tables, so there is nothing to reconcile
and no second source of truth. A GitHub assignee is deliberately not mapped onto a
CRM "responsible person": the two answer different questions.
