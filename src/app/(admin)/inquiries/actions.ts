"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth/state";
import { teamMembers } from "@/lib/admin/auth/config";
import { assertSyntheticReviewDatabase } from "@/lib/admin/review-guard";
import * as data from "@/lib/dashboard/data";
import { mayApprove } from "@/lib/dashboard/approval";
import { getSqlGateway, isLocalDashboardDemo } from "@/lib/sql-gateway";
import { selectGenerator } from "@/lib/preparation/config";
import { createSqlPreparationStore } from "@/lib/preparation/sql-store";
import { runPreparationBatch } from "@/lib/preparation/worker";
import { createMockGenerator } from "@/lib/preparation/mock-generator";
import type { PreparationGenerator } from "@/lib/preparation/generator";

// Every action re-checks the team session before touching anything, and
// validates its input. Next.js additionally rejects cross-origin action calls.

const id = z.string().uuid();
const refresh = (inquiryId: string) => {
  revalidatePath(`/inquiries/${inquiryId}`);
  revalidatePath("/inquiries");
};

// Owners: "" (unassigned) or comma-separated ids of current team members.
export async function setOwnersAction(form: FormData) {
  await requireAdmin();
  const inquiryId = id.parse(form.get("inquiryId"));
  const known = new Set(teamMembers().map((m) => m.id));
  const owners = String(form.get("owners") ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (owners.some((o) => !known.has(o))) return;
  await data.setOwners(inquiryId, [...new Set(owners)]);
  refresh(inquiryId);
}

// A follow-up always has exactly one responsible team member and a due date.
const followUp = z.object({
  action: z.string().trim().min(1).max(500),
  owner: z.string(),
  dueOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d)),
});

export async function addFollowUpAction(form: FormData) {
  const member = await requireAdmin();
  const inquiryId = id.parse(form.get("inquiryId"));
  const parsed = followUp.safeParse({ action: form.get("action"), owner: form.get("owner"), dueOn: form.get("dueOn") });
  if (!parsed.success || !teamMembers().some((m) => m.id === parsed.data.owner)) return;
  await data.addFollowUp(inquiryId, parsed.data.action, parsed.data.owner, parsed.data.dueOn, member.email);
  refresh(inquiryId);
}

export async function completeFollowUpAction(form: FormData) {
  const member = await requireAdmin();
  const inquiryId = id.parse(form.get("inquiryId"));
  const followUpId = id.parse(form.get("followUpId"));
  await data.completeFollowUp(inquiryId, followUpId, member.email);
  refresh(inquiryId);
}

export async function addNoteAction(form: FormData) {
  const member = await requireAdmin();
  const inquiryId = id.parse(form.get("inquiryId"));
  const body = z.string().trim().min(1).max(4000).safeParse(form.get("body"));
  if (!body.success) return;
  await data.addNote(inquiryId, member.email, body.data);
  refresh(inquiryId);
}

export async function saveDraftAction(form: FormData) {
  const member = await requireAdmin();
  const inquiryId = id.parse(form.get("inquiryId"));
  const body = z.string().trim().min(1).max(20000).safeParse(form.get("body"));
  if (!body.success) return;
  const source = form.get("source") === "edited" ? "edited" : "manual";
  await data.saveDraft(inquiryId, body.data, source, member.email);
  refresh(inquiryId);
}

export async function reviewAction(form: FormData) {
  const member = await requireAdmin();
  const inquiryId = id.parse(form.get("inquiryId"));
  const version = z.coerce.number().int().min(1).parse(form.get("version"));
  const to = z.enum(["in_review", "approved", "draft"]).parse(form.get("to"));
  if (to === "approved") {
    // Teammate approval is enforced here, not only in the page: whoever wrote
    // a version cannot approve it, however the request was made.
    const draft = (await data.getInquiry(inquiryId))?.drafts.find((d) => d.version === version);
    if (!draft || !mayApprove(draft, member.email)) return;
  }
  await data.review(inquiryId, version, to, member.email);
  refresh(inquiryId);
}

export async function retryAction(form: FormData) {
  await requireAdmin();
  const inquiryId = id.parse(form.get("inquiryId"));
  await data.retryPreparation(inquiryId);
  refresh(inquiryId);
}

export async function markManualAction(form: FormData) {
  await requireAdmin();
  const inquiryId = id.parse(form.get("inquiryId"));
  await data.markManual(inquiryId);
  refresh(inquiryId);
}

export async function resumeAutomationAction(form: FormData) {
  await requireAdmin();
  const inquiryId = id.parse(form.get("inquiryId"));
  const provider = z.enum(["mock", "codecraft"]).parse(form.get("provider"));
  await data.resumeAutomation(provider);
  refresh(inquiryId);
}

// "Prepare this inquiry now" with the configured generator (off by default).
export async function prepareNowAction(form: FormData) {
  await requireAdmin();
  await assertSyntheticReviewDatabase();
  const inquiryId = id.parse(form.get("inquiryId"));
  const selection = selectGenerator();
  if (!selection.enabled) return;
  await runPreparationBatch({
    store: createSqlPreparationStore(getSqlGateway()),
    generator: selection.generator,
    monthlyTokenBudget: selection.monthlyTokenBudget,
    inquiryId,
  });
  refresh(inquiryId);
}

// ---------------------------------------------------------------------------
// LOCAL DEMO ONLY. Simulations of booking webhooks and generator outcomes,
// available only with the local demo database outside production.

const demoGenerator = (outcome: "mock" | "invalid" | "quota"): PreparationGenerator =>
  outcome === "mock"
    ? createMockGenerator()
    : {
        id: "mock",
        model: "simulated-failure",
        estimateTokens: () => 0,
        generate: async () =>
          outcome === "quota"
            ? { ok: false, failure: "quota_exhausted", retryable: false, pauseAutomation: true }
            : { ok: false, failure: "invalid_output", retryable: false, pauseAutomation: false },
      };

export async function demoGenerateAction(form: FormData) {
  await requireAdmin();
  if (!isLocalDashboardDemo()) return;
  const inquiryId = id.parse(form.get("inquiryId"));
  const outcome = z.enum(["mock", "invalid", "quota"]).parse(form.get("outcome"));
  await runPreparationBatch({ store: createSqlPreparationStore(getSqlGateway()), generator: demoGenerator(outcome), monthlyTokenBudget: 0, inquiryId });
  refresh(inquiryId);
}

export async function demoBookingAction(form: FormData) {
  await requireAdmin();
  if (!isLocalDashboardDemo()) return;
  const inquiryId = id.parse(form.get("inquiryId"));
  const kind = z.enum(["book", "reschedule", "cancel"]).parse(form.get("kind"));
  const detail = await data.getInquiry(inquiryId);
  if (!detail) return;
  const sql = getSqlGateway();
  const now = Date.now();
  const at = (days: number) => new Date(now + days * 86_400_000).toISOString();
  const uid = detail.meeting.cal_booking_id;
  if (kind === "book") {
    await sql.call("apply_booking_created", { p_inquiry_id: inquiryId, p_uid: `demo-${now}`, p_start_time: at(3), p_timezone: "Africa/Cairo", p_event_at: new Date(now).toISOString() });
  } else if (kind === "reschedule" && uid) {
    await sql.call("apply_booking_rescheduled", { p_inquiry_id: inquiryId, p_reschedule_uid: uid, p_new_uid: `demo-${now}`, p_start_time: at(5), p_timezone: "Africa/Cairo", p_event_at: new Date(now).toISOString() });
  } else if (kind === "cancel" && uid) {
    await sql.call("apply_booking_cancelled", { p_inquiry_id: inquiryId, p_uid: uid, p_start_time: detail.meeting.meeting_start_at ?? at(3), p_timezone: "Africa/Cairo", p_event_at: new Date(now).toISOString() });
  }
  refresh(inquiryId);
}
