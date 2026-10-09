"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth/state";
import * as crm from "@/lib/crm/data";
import { prospectSchema, prospectStageSchema, touchSchema } from "@/lib/crm/schemas";
import { memberId, mutate, parseForm, uuid } from "../mutate";

// The outreach workflow records what the team does. Nothing here sends a
// message to anyone, and nothing is ever sent automatically.

export async function createProspectAction(form: FormData) {
  const member = await requireAdmin();
  let created: string | null = null;
  let failure = "failed";
  try {
    const v = parseForm(prospectSchema, form);
    memberId(v.owner);
    created = await crm.saveProspect(null, v, member.email);
  } catch {
    failure = "invalid";
  }
  if (created) redirect(`/outreach/${created}?n=created`);
  redirect(`/outreach?e=${failure}#add`);
}

export async function saveProspectAction(form: FormData) {
  const member = await requireAdmin();
  const id = uuid(form, "prospectId");
  await mutate(`/outreach/${id}`, "saved", async () => {
    const v = parseForm(prospectSchema, form);
    memberId(v.owner);
    await crm.saveProspect(id, v, member.email);
  }, "research");
}

// Moves along the stages. Contacted, replied and qualified need a next action
// with one responsible person and a date; closing needs a reason.
export async function prospectStageAction(form: FormData) {
  const member = await requireAdmin();
  const id = uuid(form, "prospectId");
  await mutate(`/outreach/${id}`, "saved", async () => {
    const v = parseForm(prospectStageSchema, form);
    const needsNext = ["contacted", "replied", "qualified"].includes(v.stage);
    if (needsNext && (!v.action || !v.owner || !v.dueOn)) throw new z.ZodError([{ code: "custom", message: "follow_up_required", path: [], input: v.stage }]);
    if (v.owner) memberId(v.owner);
    const next = v.action && v.owner && v.dueOn ? { action: v.action, owner: v.owner, dueOn: v.dueOn } : null;
    await crm.setProspectStage(id, v.stage, member.email, next, v.reason);
  }, "stage");
}

export async function prospectFollowUpAction(form: FormData) {
  const member = await requireAdmin();
  const id = uuid(form, "prospectId");
  await mutate(`/outreach/${id}`, "followUpSaved", async () => {
    const v = z.object({ action: z.string().trim().min(1).max(500), owner: z.string(), dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse({ action: form.get("action"), owner: form.get("owner"), dueOn: form.get("dueOn") });
    await crm.setProspectFollowUp(id, v.action, memberId(v.owner), v.dueOn, member.email);
  }, "stage");
}

export async function logTouchAction(form: FormData) {
  const member = await requireAdmin();
  const id = uuid(form, "prospectId");
  await mutate(`/outreach/${id}`, "touchLogged", async () => {
    const v = parseForm(touchSchema, form);
    if (v.owner) memberId(v.owner);
    const next = v.action && v.owner && v.dueOn ? { action: v.action, owner: v.owner, dueOn: v.dueOn } : null;
    await crm.logTouch(id, { kind: v.kind, touchNo: v.kind === "outbound" ? v.touchNo : null, channel: v.channel, occurredOn: v.occurredOn, summary: v.summary }, member.email, next);
  }, "touches");
}

export async function linkProspectAction(form: FormData) {
  const member = await requireAdmin();
  const id = uuid(form, "prospectId");
  await mutate(`/outreach/${id}`, "linked", async () => {
    await crm.linkProspectInquiry(id, uuid(form, "inquiryId"), member.email);
  }, "link");
}
