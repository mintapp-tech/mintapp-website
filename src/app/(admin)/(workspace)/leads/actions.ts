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
import { mayApproveArtifact } from "@/lib/pack/state";
import { renderableDesign, splitPack, validatePack } from "@/lib/pack/schema";
import { buildGenerationInput } from "@/lib/preparation/input";
import { knownDetails } from "@/lib/preparation/scrub";
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
// enforced here as well as in the page.
export async function packReviewAction(form: FormData) {
  const member = await requireAdmin();
  const inquiryId = uuid(form, "inquiryId");
  await mutate(leadPath(inquiryId, "pack"), "reviewChanged", async () => {
    const version = z.coerce.number().int().min(1).parse(form.get("version"));
    const to = z.enum(["in_review", "approved", "draft"]).parse(form.get("to"));
    const draft = (await dashboard.getInquiry(inquiryId))?.drafts.find((d) => d.version === version);
    if (!draft || draft.artifact === "note") throw notAllowed();
    if (to === "approved" && !mayApproveArtifact(draft, member.email)) throw new z.ZodError([{ code: "custom", message: "teammate_approval_required", path: [], input: to }]);
    if (!(await dashboard.review(inquiryId, version, to, member.email))) throw notAllowed();
  }, `artifact-${form.get("artifact") === "proposal" ? "proposal" : form.get("artifact") === "discovery" ? "discovery" : "design"}`);
}

// A founder's edit of one artifact, as text: always a new version.
export async function packEditTextAction(form: FormData) {
  const member = await requireAdmin();
  const inquiryId = uuid(form, "inquiryId");
  const which = artifact.parse(form.get("artifact"));
  await mutate(leadPath(inquiryId, "pack"), "packSaved", async () => {
    const body = z.string().trim().min(1).max(20000).parse(form.get("body"));
    const source = form.get("source") === "manual" ? "manual" : "edited";
    await crm.packSaveArtifact(inquiryId, which, { format: "text", body }, source, member.email);
  }, `artifact-${which}`);
}

// The design's structured data, edited directly: accepted only if it is still a
// library design (the same check the renderer applies).
export async function packEditDesignAction(form: FormData) {
  const member = await requireAdmin();
  const inquiryId = uuid(form, "inquiryId");
  await mutate(leadPath(inquiryId, "pack"), "packSaved", async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(z.string().max(40000).parse(form.get("body")));
    } catch {
      throw new z.ZodError([{ code: "custom", message: "design_invalid", path: [], input: null }]);
    }
    const design = renderableDesign({ format: "pack-design", ...(parsed as object) });
    if (!design) throw new z.ZodError([{ code: "custom", message: "design_invalid", path: [], input: null }]);
    await crm.packSaveArtifact(inquiryId, "design", design, "edited", member.email);
  }, "artifact-design");
}

const PROBLEM_KINDS = new Set(["schema", "wrong_language", "ungrounded_fact", "unsupported_number", "commitment", "pattern_kind", "template_not_in_pattern", "screens", "flow_screen"]);

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

  const detail = await dashboard.getInquiry(inquiryId);
  if (!detail) redirect(`${back}?e=failed#claude`);
  const i = detail.inquiry;
  const input = buildGenerationInput({
    preferred_language: i.language,
    project_type: i.project_type,
    project_description: i.project_description,
    budget_range: i.budget_range,
    timeline: i.timeline,
    country: i.country,
    redact: knownDetails({ client_name: i.client_name, company_name: i.company_name, email: i.email, phone: i.phone, company_url: i.company_url }),
  });
  const result = validatePack(json, { brief: input.brief, language: input.language, projectType: input.projectType });
  if (!result.ok) {
    const kinds = [...new Set(result.problems.map((p) => p.kind))].filter((k) => PROBLEM_KINDS.has(k)).slice(0, 6);
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
    await runPreparationBatch({ store: createSqlPreparationStore(getSqlGateway()), generator: selection.generator, monthlyTokenBudget: selection.monthlyTokenBudget, inquiryId });
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

