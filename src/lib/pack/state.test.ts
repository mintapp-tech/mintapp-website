import { describe, expect, test } from "vitest";
import { manualReason, mayApproveArtifact, packState, type LatestArtifact, type PackInputs } from "./state";

const a = (review_status: LatestArtifact["review_status"], over: Partial<LatestArtifact> = {}): LatestArtifact => ({ version: 1, review_status, source: "codecraft", created_by: "automation", ...over });
const base: PackInputs = { job: "waiting_booking", artifacts: {}, reviewDue: null, today: "2026-10-10", automation: { enabled: false, paused: false } };
const all = (s: LatestArtifact["review_status"]) => ({ design: a(s), proposal: a(s), discovery: a(s) });

describe("pack state in plain language", () => {
  test("before a booking: not started", () => {
    expect(packState(base)).toBe("not_started");
  });
  test("queued with automation on: preparing; with automation off or paused: needs manual action", () => {
    expect(packState({ ...base, job: "queued", automation: { enabled: true, paused: false } })).toBe("preparing");
    expect(packState({ ...base, job: "running", automation: { enabled: true, paused: false } })).toBe("preparing");
    expect(packState({ ...base, job: "queued" })).toBe("needs_manual");
    expect(packState({ ...base, job: "queued", automation: { enabled: true, paused: true } })).toBe("needs_manual");
    expect(packState({ ...base, job: "failed", automation: { enabled: true, paused: false } })).toBe("needs_manual");
  });
  test("all three artifacts present: ready for review; all approved: approved for meeting", () => {
    expect(packState({ ...base, job: "succeeded", artifacts: all("draft") })).toBe("ready_for_review");
    expect(packState({ ...base, job: "succeeded", artifacts: { ...all("approved"), proposal: a("in_review") } })).toBe("ready_for_review");
    expect(packState({ ...base, job: "succeeded", artifacts: all("approved") })).toBe("approved");
  });
  test("past the review deadline and not approved: needs attention; approved stays approved", () => {
    expect(packState({ ...base, job: "succeeded", artifacts: all("draft"), reviewDue: "2026-10-09" })).toBe("needs_attention");
    expect(packState({ ...base, job: "queued", reviewDue: "2026-10-09" })).toBe("needs_attention");
    expect(packState({ ...base, job: "succeeded", artifacts: all("approved"), reviewDue: "2026-10-09" })).toBe("approved");
    expect(packState({ ...base, job: "succeeded", artifacts: all("draft"), reviewDue: "2026-10-10" })).toBe("ready_for_review");
  });
  test("a design no pattern fits, or a partial pack, needs a person", () => {
    const unsupported = { ...all("draft"), design: a("draft", { unsupported: true }) };
    expect(packState({ ...base, job: "succeeded", artifacts: unsupported })).toBe("needs_manual");
    expect(manualReason({ job: "succeeded", artifacts: unsupported, automation: base.automation })).toBe("unsupported_design");
    expect(packState({ ...base, job: "manual", artifacts: { proposal: a("draft") } })).toBe("needs_manual");
    expect(manualReason({ job: "manual", artifacts: { proposal: a("draft") }, automation: base.automation })).toBe("incomplete");
  });
  test("the reason for manual action names the cause", () => {
    expect(manualReason({ job: "queued", artifacts: {}, automation: { enabled: false, paused: false } })).toBe("automation_off");
    expect(manualReason({ job: "queued", artifacts: {}, automation: { enabled: true, paused: true } })).toBe("automation_paused");
    expect(manualReason({ job: "failed", artifacts: {}, automation: { enabled: true, paused: false } })).toBe("failed");
    expect(manualReason({ job: "manual", artifacts: {}, automation: { enabled: true, paused: false } })).toBe("manual");
  });
});

describe("approval", () => {
  test("the founder who wrote a version cannot approve it; the other can; automation's versions either can", () => {
    expect(mayApproveArtifact({ created_by: "omar@mintapp.tech", review_status: "in_review" }, "Omar@Mintapp.tech")).toBe(false);
    expect(mayApproveArtifact({ created_by: "omar@mintapp.tech", review_status: "in_review" }, "adam@mintapp.tech")).toBe(true);
    expect(mayApproveArtifact({ created_by: "automation", review_status: "in_review" }, "omar@mintapp.tech")).toBe(true);
    expect(mayApproveArtifact({ created_by: "automation", review_status: "draft" }, "omar@mintapp.tech")).toBe(false);
  });
});
