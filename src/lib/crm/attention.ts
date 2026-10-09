import { needsApprovalBeforeMeeting } from "@/lib/dashboard/approval";
import { isOpenStage } from "./stages";
import type { InquiryListRow } from "./types";

// Why an inquiry needs a person's attention. Pure, shared by the list, the
// filter and the tests. The goal (campaign playbook, section 15): every lead
// has an owner and a next action, no follow-up date is missed, and every booked
// meeting has an approved preparation note.

export type AttentionReason = "preparation" | "no_owner" | "no_next_action" | "overdue_follow_up" | "needs_approval";

const STUCK = new Set(["failed", "paused"]);

export function attentionReasons(row: InquiryListRow, opts: { today: string; automationEnabled: boolean; now?: Date }): AttentionReason[] {
  const reasons: AttentionReason[] = [];
  const waiting = (row.preparation_status === "queued" || row.preparation_status === "retry_scheduled") && !opts.automationEnabled;
  if (STUCK.has(row.preparation_status ?? "") || waiting || !row.preparation_status) reasons.push("preparation");
  if (isOpenStage(row.lead_status)) {
    if (row.owners.length === 0) reasons.push("no_owner");
    if (!row.next_follow_up) reasons.push("no_next_action");
  }
  if (row.next_follow_up && row.next_follow_up.due_on < opts.today) reasons.push("overdue_follow_up");
  if (needsApprovalBeforeMeeting(row, opts.now ?? new Date())) reasons.push("needs_approval");
  return reasons;
}
