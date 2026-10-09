"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth/state";
import * as crm from "@/lib/crm/data";
import { detailsSchema, proposalMove, proposalSchema, stageSchema } from "@/lib/crm/schemas";
import { leadPath, type LeadTab } from "@/lib/crm/lead-path";
import { memberId, mutate, optionalUuid, parseForm, uuid } from "../mutate";

// Server actions for an inquiry's CRM side. Each one re-checks the signed-in
// team member, validates what was posted, and records who did it.

// Back to the lead's tab that holds the form: the proposal and the project are on Deal.
const pathOf = (inquiryId: string, tab: LeadTab = "overview") => leadPath(inquiryId, tab);

export async function setStageAction(form: FormData) {
  const member = await requireAdmin();
  const inquiryId = uuid(form, "inquiryId");
  await mutate(pathOf(inquiryId), "stageChanged", async () => {
    const v = parseForm(stageSchema, form);
    await crm.setStage(inquiryId, v.stage, member.email, v.stage === "lost" ? v.reason : null, v.stage === "lost" || v.stage === "paused" ? v.note : null, v.stage === "paused" ? v.pausedUntil : null);
  }, "stage");
}

export async function saveDetailsAction(form: FormData) {
  const member = await requireAdmin();
  const inquiryId = uuid(form, "inquiryId");
  await mutate(pathOf(inquiryId), "saved", async () => {
    const v = parseForm(detailsSchema, form);
    await crm.saveInquiryDetails(inquiryId, v, member.email);
  }, "source");
}

// Builds the contact (and optionally the company) from the form the client sent.
export async function createFromInquiryAction(form: FormData) {
  const member = await requireAdmin();
  const inquiryId = uuid(form, "inquiryId");
  await mutate(pathOf(inquiryId), "created", async () => {
    const mode = z.enum(["none", "existing", "new"]).parse(form.get("companyMode"));
    const companyId = mode === "existing" ? uuid(form, "companyId") : null;
    await crm.createFromInquiry(inquiryId, mode, companyId, member.email);
  }, "company");
}

// Points the inquiry at an existing company, keeping the contact it already has.
export async function linkCompanyAction(form: FormData) {
  const member = await requireAdmin();
  const inquiryId = uuid(form, "inquiryId");
  await mutate(pathOf(inquiryId), "linked", async () => {
    const companyId = optionalUuid(form, "companyId");
    const extra = await crm.inquiryExtra(inquiryId);
    await crm.linkInquiry(inquiryId, companyId, extra?.contact?.id ?? null, member.email);
  }, "company");
}

export async function startProposalAction(form: FormData) {
  const member = await requireAdmin();
  const inquiryId = uuid(form, "inquiryId");
  await mutate(pathOf(inquiryId, "deal"), "proposalSaved", async () => {
    await crm.createProposal(inquiryId, parseForm(proposalSchema, form), member.email);
  }, "proposal");
}

// Saves changes to a draft in place.
export async function saveProposalAction(form: FormData) {
  const member = await requireAdmin();
  const inquiryId = uuid(form, "inquiryId");
  await mutate(pathOf(inquiryId, "deal"), "proposalSaved", async () => {
    await crm.updateProposal(uuid(form, "proposalId"), parseForm(proposalSchema, form), member.email);
  }, "proposal");
}

// A revision is always a new version: the earlier one is kept as superseded.
export async function reviseProposalAction(form: FormData) {
  const member = await requireAdmin();
  const inquiryId = uuid(form, "inquiryId");
  await mutate(pathOf(inquiryId, "deal"), "proposalSaved", async () => {
    await crm.createProposal(inquiryId, parseForm(proposalSchema, form), member.email);
  }, "proposal");
}

// Status moves. The database refuses an approval by the person who wrote or
// last edited the version; this checks too so a forged request gets the same answer.
export async function proposalMoveAction(form: FormData) {
  const member = await requireAdmin();
  const inquiryId = uuid(form, "inquiryId");
  await mutate(pathOf(inquiryId, "deal"), "proposalMoved", async () => {
    const to = proposalMove.parse(form.get("to"));
    const proposalId = uuid(form, "proposalId");
    if (to === "approved") {
      const proposal = (await crm.inquiryExtra(inquiryId))?.proposals.find((p) => p.id === proposalId);
      const email = member.email.trim().toLowerCase();
      if (!proposal || proposal.status !== "internal_review" || proposal.created_by.toLowerCase() === email || proposal.updated_by.toLowerCase() === email) {
        throw new z.ZodError([{ code: "custom", message: "teammate_approval_required", path: [], input: to }]);
      }
    }
    const note = z.string().trim().max(1000).parse(form.get("note") ?? "");
    await crm.proposalTransition(proposalId, to, member.email, note === "" ? null : note);
  }, "proposal");
}

export async function convertAction(form: FormData) {
  const member = await requireAdmin();
  const inquiryId = uuid(form, "inquiryId");
  await mutate(pathOf(inquiryId, "deal"), "projectCreated", async () => {
    const name = z.string().trim().max(160).parse(form.get("name") ?? "");
    await crm.convertToProject(inquiryId, name === "" ? null : name, member.email);
  }, "conversion");
}

// Owners: "" (unassigned) or comma-separated ids of current team members.
export async function setOwnersAction(form: FormData) {
  const member = await requireAdmin();
  const inquiryId = uuid(form, "inquiryId");
  await mutate(pathOf(inquiryId), "saved", async () => {
    const owners = String(form.get("owners") ?? "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean)
      .map(memberId);
    await crm.setOwners(inquiryId, [...new Set(owners)], member.email);
  }, "owner");
}
