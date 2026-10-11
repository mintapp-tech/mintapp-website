"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth/state";
import { assertSyntheticReviewDatabase } from "@/lib/admin/review-guard";
import * as crm from "@/lib/crm/data";
import * as dashboard from "@/lib/dashboard/data";
import { dealSchema, pauseSchema, positionSchema, prioritySchema, settingsSchema } from "@/lib/crm/schemas";
import { stageToWrite } from "@/lib/crm/simple-stages";
import { leadPath } from "@/lib/crm/lead-path";
import { packContext, packInput } from "@/lib/crm/pack-input";
import { mayApproveArtifact } from "@/lib/pack/state";
import { PROBLEM_KINDS, splitPack, validateArtifact, validatePack, type PackProblem } from "@/lib/pack/schema";
import { contentFrom, fieldsFromForm, type Fields } from "@/lib/pack/editor";
import { selectGenerator } from "@/lib/preparation/config";
import { createSqlPreparationStore } from "@/lib/preparation/sql-store";
import { runPreparationBatch } from "@/lib/preparation/worker";
import { getSqlGateway } from "@/lib/sql-gateway";
import { memberId, mutate, parseForm, uuid } from "../mutate";

// Server actions for Leads & Clients. Each one re-checks the signed-in founder,
// validates what was posted, records who did it, and returns to the tab it came from.

const artifact = z.enum(["design", "proposal", "discovery"]);
const notAllowed = () => new z.ZodError([{ code: "custom", message: "not_allowed", path: [], input: null }]);

// ----- Overview: position, priority, pause, owner of the review

export async function setPositionAction(form: FormData) {
  const member = await requireAdmin();
  const inquiryId = uuid(form, "inquiryId");
  await mutate(leadPath(inquiryId), "stageChanged", async () => {
    const v = parseForm(positionSchema, form);
    const extra = await crm.inquiryExtra(inquiryId);
    if (!extra) throw notAllowed();
    const to = stageToWrite(extra.stage, v.position);
    if (to) await crm.setStage(inquiryId, to, member.email, to === "lost" ? v.reason : null, to === "lost" ? v.note : null, null);
  }, "position");
}

export async function setPriorityAction(form: FormData) {
  const member = await requireAdmin();
  const inquiryId = uuid(form, "inquiryId");
  await mutate(leadPath(inquiryId), "saved", async () => {
    await crm.saveLead(inquiryId, parseForm(prioritySchema, form), member.email);
  }, "position");
}

export async function pauseAction(form: FormData) {
  const member = await requireAdmin();
  const inquiryId = uuid(form, "inquiryId");
  const resume = form.get("resume") === "1";
  await mutate(leadPath(inquiryId), resume ? "resumed" : "paused", async () => {
    const until = resume ? null : parseForm(pauseSchema, form).pausedUntil;
    if (!resume && !until) throw notAllowed();
    await crm.saveLead(inquiryId, { paused_until: until ?? "" }, member.email);
  }, "position");
}

// "I will review it": the automatic review action is given to whoever takes it.
export async function takeReviewAction(form: FormData) {
  const member = await requireAdmin();
  const inquiryId = uuid(form, "inquiryId");
  await mutate(leadPath(inquiryId, "pack"), "saved", async () => {
    const followUpId = uuid(form, "followUpId");
    await crm.assignFollowUp(inquiryId, followUpId, memberId(member.id), member.email);
  });
}

// Give an open action (for example an automatic review with no owner yet) to one founder.
export async function assignActionAction(form: FormData) {
  const member = await requireAdmin();
  const inquiryId = uuid(form, "inquiryId");
  await mutate(leadPath(inquiryId), "saved", async () => {
    await crm.assignFollowUp(inquiryId, uuid(form, "followUpId"), memberId(form.get("owner")), member.email);
  }, "next");
}

// ----- Deal

export async function saveDealAction(form: FormData) {
  const member = await requireAdmin();
  const inquiryId = uuid(form, "inquiryId");
  await mutate(leadPath(inquiryId, "deal"), "saved", async () => {
    await crm.saveLead(inquiryId, parseForm(dealSchema, form), member.email);
  }, "contract");
}

// ----- The Pre-meeting Pack

// Review one artifact's version. Approval is by the founder who did not write it,
// enforced here as well as in the page, and only after they confirm the approval
// checklist.
export async function packReviewAction(form: FormData) {
  const member = await requireAdmin();
  const inquiryId = uuid(form, "inquiryId");
  await mutate(leadPath(inquiryId, "pack"), "reviewChanged", async () => {
    const version = z.coerce.number().int().min(1).parse(form.get("version"));
    const to = z.enum(["in_review", "approved", "draft"]).parse(form.get("to"));
    const draft = (await dashboard.getInquiry(inquiryId))?.drafts.find((d) => d.version === version);
    if (!draft || draft.artifact === "note") throw notAllowed();
    if (to === "approved" && !mayApproveArtifact(draft, member.email)) throw new z.ZodError([{ code: "custom", message: "teammate_approval_required", path: [], input: to }]);
    if (to === "approved" && form.get("checked") !== "1") throw new z.ZodError([{ code: "custom", message: "checklist_required", path: [], input: to }]);
    if (!(await dashboard.review(inquiryId, version, to, member.email))) throw notAllowed();
  }, `artifact-${form.get("artifact") === "proposal" ? "proposal" : form.get("artifact") === "discovery" ? "discovery" : "design"}`);
}

// What the structured editor gets back when a version is refused: the problems in
// plain-language keys, and the fields as typed (so nothing is lost).
export interface PackEditState {
  problems: { kind: PackProblem["kind"]; section?: string }[];
  fields: Fields | null;
  attempt: number;
}

// A founder's edit of one part, section by section: built into the structured
// format and checked exactly as automation is, then saved as a new version. A
// refused edit keeps everything typed and says why.
export async function packEditAction(previous: PackEditState, form: FormData): Promise<PackEditState> {
  const member = await requireAdmin();
  const inquiryId = uuid(form, "inquiryId");
  const which = artifact.parse(form.get("artifact"));
  const fields = fieldsFromForm(form);
  const [detail, lead] = await Promise.all([dashboard.getInquiry(inquiryId), crm.leadDetail(inquiryId)]);
  if (!detail) return { problems: [{ kind: "schema" }], fields, attempt: previous.attempt + 1 };
  const input = packInput(detail.inquiry, lead?.budget_currency);
  const result = validateArtifact(which, contentFrom(which, input.language, fields), packContext(input));
  if (!result.ok) {
    // The section each problem belongs to, as the form names it (the stored design keeps its blueprint as "blueprint").
    const sectionOf = (s: string | undefined) => (s === "blueprint" ? "design_blueprint" : s);
    const problems = result.problems.map((p) => ({ kind: p.kind, section: sectionOf("section" in p ? p.section : "path" in p ? p.path.split(".")[0] : "screen" in p ? "screens" : undefined) }));
    return { problems, fields, attempt: previous.attempt + 1 };
  }
  const source = form.get("source") === "manual" ? "manual" : "edited";
  return mutate(leadPath(inquiryId, "pack"), "packSaved", () => crm.packSaveArtifact(inquiryId, which, result.content, source, member.email), `artifact-${which}`);
}

const KNOWN_PROBLEMS = new Set<string>(PROBLEM_KINDS);

// The manual Claude path: the whole reply pasted back, checked exactly as an
// automated pack is (structure, language, grounded facts, no invented figures,
// library design), then saved as three versions.
export async function packPasteAction(form: FormData) {
  const member = await requireAdmin();
  const inquiryId = uuid(form, "inquiryId");
  const back = leadPath(inquiryId, "pack");
  const raw = z.string().max(60000).safeParse(form.get("body"));
  let json: unknown = null;
  if (raw.success) {
    const text = raw.data.trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    try {
      json = start >= 0 && end > start ? JSON.parse(text.slice(start, end + 1)) : null;
    } catch {
      json = null;
    }
  }
  if (!json || typeof json !== "object") redirect(`${back}?e=pack_not_json#claude`);

  // The same brief the copied prompt carried, so the facts are checked against what the founder sent.
  const [detail, lead] = await Promise.all([dashboard.getInquiry(inquiryId), crm.leadDetail(inquiryId)]);
  if (!detail) redirect(`${back}?e=failed#claude`);
  const input = packInput(detail.inquiry, lead?.budget_currency);
  const result = validatePack(json, packContext(input));
  if (!result.ok) {
    const kinds = [...new Set(result.problems.map((p) => p.kind))].filter((k) => KNOWN_PROBLEMS.has(k)).slice(0, 6);
    redirect(`${back}?e=pack_invalid&p=${kinds.join(",")}#claude`);
  }
  await mutate(back, "packSaved", async () => {
    await crm.packSaveAll(inquiryId, splitPack(result.pack), "manual", member.email);
  }, "pack-state");
}

// Prepare now: before a booking (or after a failure), run the configured
// automation for this lead immediately. Off unless automation is enabled.
export async function prepareNowLeadAction(form: FormData) {
  await requireAdmin();
  await assertSyntheticReviewDatabase();
  const inquiryId = uuid(form, "inquiryId");
  const selection = selectGenerator();
  await mutate(leadPath(inquiryId, "pack"), "prepared", async () => {
    if (!selection.enabled) throw notAllowed();
    await dashboard.retryPreparation(inquiryId);
    await runPreparationBatch({ store: createSqlPreparationStore(getSqlGateway()), generator: selection.generator, monthlyTokenBudget: selection.monthlyTokenBudget, packTokenCap: selection.packTokenCap, inquiryId });
  }, "pack-state");
}

// ----- Settings

export async function saveSettingsAction(form: FormData) {
  const member = await requireAdmin();
  await mutate("/settings", "saved", async () => {
    const v = parseForm(settingsSchema, form);
    if (v.default_owner) memberId(v.default_owner);
    await crm.setSetting("default_owner", v.default_owner, member.email);
  });
}

export async function resumeAutomationSettingsAction(form: FormData) {
  await requireAdmin();
  await mutate("/settings", "saved", async () => {
    await dashboard.resumeAutomation(z.enum(["mock", "codecraft"]).parse(form.get("provider")));
  });
}

