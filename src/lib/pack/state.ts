// The Pre-meeting Pack's state in plain language, from the job and the latest
// version of each artifact. Pure, so it is unit-tested. Technical job statuses
// stay internal; this is what the team reads.

export const ARTIFACTS = ["design", "proposal", "discovery"] as const;
export type Artifact = (typeof ARTIFACTS)[number];

export type PackState = "not_started" | "preparing" | "needs_manual" | "ready_for_review" | "approved" | "needs_attention";

export interface LatestArtifact {
  version: number;
  review_status: "draft" | "in_review" | "approved" | "superseded";
  source: string;
  created_by: string;
  unsupported?: boolean;
}

export interface PackInputs {
  job: string | null;
  artifacts: Partial<Record<Artifact, LatestArtifact>>;
  reviewDue: string | null; // YYYY-MM-DD
  today: string; // YYYY-MM-DD
  automation: { enabled: boolean; paused: boolean };
}

export function packState({ job, artifacts, reviewDue, today, automation }: PackInputs): PackState {
  const present = ARTIFACTS.filter((a) => artifacts[a]);
  const usable = present.filter((a) => !artifacts[a]!.unsupported);
  const approved = ARTIFACTS.every((a) => artifacts[a]?.review_status === "approved" && !artifacts[a]!.unsupported);
  if (approved) return "approved";
  if (reviewDue && reviewDue < today) return "needs_attention";
  if (usable.length === ARTIFACTS.length) return "ready_for_review";
  const working = job === "queued" || job === "running" || job === "retry_scheduled";
  if (present.length === 0 && (job === "waiting_booking" || job === null)) return "not_started";
  if (present.length === 0 && working && automation.enabled && !automation.paused) return "preparing";
  // Automation off, paused or failed, a manual hand-over, a design no pattern
  // fits, or only part of the pack: a person has to act.
  return "needs_manual";
}

// Why a person has to act, for the "Needs manual action" explanation.
export type ManualReason = "automation_off" | "automation_paused" | "failed" | "manual" | "unsupported_design" | "incomplete";

export function manualReason({ job, artifacts, automation }: Omit<PackInputs, "reviewDue" | "today">): ManualReason {
  if (artifacts.design?.unsupported) return "unsupported_design";
  if (ARTIFACTS.some((a) => artifacts[a])) return "incomplete";
  if (job === "failed") return "failed";
  if (job === "paused" || automation.paused) return "automation_paused";
  if (job === "manual") return "manual";
  return "automation_off";
}

// A version may be approved only by the founder who did not write it.
// Automation-written versions ("automation") may be approved by either.
export const mayApproveArtifact = (a: { created_by: string; review_status: string }, member: string) =>
  a.review_status === "in_review" && a.created_by.trim().toLowerCase() !== member.trim().toLowerCase();
