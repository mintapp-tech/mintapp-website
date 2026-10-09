// Rules for who may approve a preparation note, and which meetings still need
// one. Pure, so they are unit-tested and shared by the pages (to hide a button)
// and by the server action (to refuse a forged request).

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// A person who wrote a version may not approve it: a teammate must read it
// first. Versions made by automation (created_by "automation") have no human
// author, so either teammate may approve them.
export const isAuthor = (draft: { created_by: string }, member: string) => same(draft.created_by, member);

// Approval applies only to a version that was marked ready for review.
export const mayApprove = (draft: { created_by: string; review_status: string }, member: string) => draft.review_status === "in_review" && !isAuthor(draft, member);

// A booked meeting that has not happened yet and has no approved preparation
// note. Cancelled, completed and unbooked inquiries are not flagged.
export function needsApprovalBeforeMeeting(row: { booking_status: string; meeting_start_at: string | null; approved_version: number | null }, now: Date = new Date()): boolean {
  if (row.booking_status !== "booked" || !row.meeting_start_at || row.approved_version) return false;
  return new Date(row.meeting_start_at).getTime() > now.getTime();
}
