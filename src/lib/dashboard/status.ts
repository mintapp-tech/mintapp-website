// Plain-language status for the dashboard. Pure, so it is unit-tested.
// The goal is that no inquiry silently waits: whenever automation cannot
// produce a draft (off, paused, failed, out of budget), the inquiry is
// flagged as needing attention with the manual path offered.

export type Tone = "attention" | "info" | "ok";

const ERROR_LABELS: Record<string, string> = {
  timeout: "the provider took too long to answer",
  rate_limited: "the provider asked us to slow down",
  quota_exhausted: "the provider's free allowance is used up",
  budget_exhausted: "this month's token budget is used up",
  auth_failed: "the provider rejected the API key",
  model_unavailable: "the configured model is not available",
  provider_error: "the provider had an error",
  provider_unreachable: "the provider could not be reached",
  malformed_response: "the provider's reply was not usable",
  invalid_output: "the reply was not valid JSON",
  truncated: "the reply was cut off",
  lease_expired: "a worker stopped before finishing",
  inquiry_missing: "the inquiry could not be loaded",
};

export function errorLabel(code: string | null | undefined): string {
  if (!code) return "an unknown problem";
  if (code.startsWith("invalid_ungrounded")) return "the draft quoted facts that are not in the brief";
  if (code.startsWith("invalid_unsupported")) return "the draft contained figures the client never stated";
  if (code.startsWith("invalid_wrong_language")) return "the draft was in the wrong language";
  if (code.startsWith("invalid_schema")) return "the draft did not have the required structure";
  return ERROR_LABELS[code] ?? code.replaceAll("_", " ");
}

export interface PreparationState {
  status: string;
  attempts: number;
  max_attempts: number;
  next_attempt_at: string;
  last_error: string | null;
  generator: string | null;
}

export function preparationNotice(
  prep: PreparationState | null,
  automation: { enabled: boolean; provider?: string; paused: readonly { provider: string; paused_reason: string | null }[] },
): { tone: Tone; title: string; detail: string } {
  if (!prep) return { tone: "attention", title: "No preparation job", detail: "This inquiry has no preparation record. Prepare it manually." };
  const pausedHere = automation.paused.find((p) => p.provider === (prep.generator ?? automation.provider));
  switch (prep.status) {
    case "failed":
      return { tone: "attention", title: "Automated preparation failed", detail: `Stopped after ${prep.attempts} of ${prep.max_attempts} attempts: ${errorLabel(prep.last_error)}. Prepare it manually, or retry.` };
    case "paused":
      return { tone: "attention", title: "Automation is paused", detail: `Paused because ${errorLabel(prep.last_error)}. Prepare it manually, or resume automation once that is resolved.` };
    case "queued":
    case "retry_scheduled":
      if (!automation.enabled) return { tone: "attention", title: "Waiting for manual preparation", detail: "Automated preparation is turned off. Prepare it manually." };
      if (pausedHere) return { tone: "attention", title: "Waiting: automation is paused", detail: `Automation is paused because ${errorLabel(pausedHere.paused_reason)}. Prepare it manually, or resume automation.` };
      return prep.status === "queued"
        ? { tone: "info", title: "Queued for automated preparation", detail: "It will be prepared on the next worker run." }
        : { tone: "info", title: "Retrying automatically", detail: `Attempt ${prep.attempts} of ${prep.max_attempts} failed (${errorLabel(prep.last_error)}). Next try ${new Date(prep.next_attempt_at).toUTCString()}.` };
    case "running":
      return { tone: "info", title: "Preparing now", detail: "A draft is being generated." };
    case "manual":
      return { tone: "ok", title: "Prepared manually", detail: "The team is preparing this inquiry by hand." };
    case "succeeded":
      return { tone: "ok", title: "Draft generated", detail: "Review and edit it before it is used." };
    default:
      return { tone: "attention", title: "Unknown preparation state", detail: prep.status };
  }
}

export const REVIEW_LABELS: Record<string, string> = {
  draft: "Draft",
  in_review: "Ready for review",
  approved: "Approved for the meeting",
  superseded: "Superseded",
};

export const MEETING_LABELS: Record<string, string> = {
  not_booked: "Not booked",
  booked: "Booked",
  cancelled: "Cancelled",
  completed: "Completed",
  no_show: "No show",
};
