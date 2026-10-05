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
- **Follow-ups:** each with one responsible person and a due date; overdue
  items stand out in the list.

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
