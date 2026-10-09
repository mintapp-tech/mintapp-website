import { z } from "zod";
import {
  CONSENT_STATUSES,
  CONTACT_CHANNELS,
  CURRENCIES,
  FIT_TIERS,
  LEAD_ORIGINS,
  LOSS_REASONS,
  PROJECT_STATUSES,
  PROSPECT_POOLS,
  PROSPECT_STAGES,
  SCORE_KEYS,
  STAGES,
  TOUCH_KINDS,
} from "./types";

// Validation for everything the team types into the CRM, before it reaches a
// database function (which validates again with its own constraints). Forms
// post every field, so an empty field means "clear it": text becomes null.

export const id = z.string().uuid();

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));
const required = (max: number) => z.string().trim().min(1).max(max);
export const isRealDay = (d: string) => {
  const t = Date.parse(`${d}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(t) && new Date(t).toISOString().startsWith(d);
};
const day = z.string().refine(isRealDay);
const optDay = z.union([z.literal(""), day]).transform((v) => (v === "" ? null : v));
const optEnum = <T extends readonly [string, ...string[]]>(values: T) => z.union([z.literal(""), z.enum(values)]).transform((v) => (v === "" ? null : v));
const optInt = (min: number, max: number) =>
  z
    .union([z.literal(""), z.string().regex(/^\d{1,4}$/)])
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((n) => n === null || (n >= min && n <= max));
const optMoney = z
  .union([z.literal(""), z.string().regex(/^\d{1,10}(\.\d{1,2})?$/)])
  .transform((v) => (v === "" ? null : Number(v)));

const phone = z
  .string()
  .trim()
  .max(60)
  .regex(/^[+0-9 ()\-.]*$/)
  .transform((v) => (v === "" ? null : v));
const email = z.union([z.literal(""), z.string().trim().toLowerCase().email().max(320)]).transform((v) => (v === "" ? null : v));
const member = z.string().regex(/^[a-z][a-z0-9-]{0,31}$/);

// ----- Companies and contacts

export const companySchema = z.object({
  name: required(160),
  website: text(300),
  country: text(80),
  sector: text(120),
  language: optEnum(["en", "ar"]),
});

export const contactSchema = z.object({
  full_name: required(160),
  role_title: text(120),
  email,
  phone,
  preferred_language: optEnum(["en", "ar"]),
  consent_status: z.enum(CONSENT_STATUSES),
  do_not_contact: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

// ----- Source and qualification

const scoreValue = z.union([z.literal(""), z.enum(["0", "1", "2"])]).default("");
export const detailsSchema = z
  .object({
    lead_origin: optEnum(LEAD_ORIGINS),
    referral_partner: text(120),
    campaign: text(120),
    content_id: text(120),
    fit_tier: optEnum(FIT_TIERS),
    trigger_note: text(500),
    research_note: text(2000),
    ...Object.fromEntries(SCORE_KEYS.map((k) => [`score_${k}`, scoreValue])),
  })
  .transform((v) => {
    const { lead_origin, referral_partner, campaign, content_id, fit_tier, trigger_note, research_note } = v;
    const entries = SCORE_KEYS.map((k) => [k, (v as Record<string, string>)[`score_${k}`]] as const).filter(([, s]) => s !== "");
    // The score is all seven categories or none: a partial score is not a score.
    const score = entries.length === SCORE_KEYS.length ? Object.fromEntries(entries.map(([k, s]) => [k, Number(s)])) : entries.length === 0 ? null : undefined;
    return { lead_origin, referral_partner, campaign, content_id, fit_tier, trigger_note, research_note, score };
  })
  .refine((v) => v.score !== undefined, { message: "score_incomplete", path: ["score"] });

// ----- Stage

export const stageSchema = z
  .object({
    stage: z.enum(STAGES),
    reason: optEnum(LOSS_REASONS),
    note: text(500),
    pausedUntil: optDay,
  })
  .refine((v) => v.stage !== "lost" || v.reason !== null, { message: "loss_reason_required", path: ["reason"] });

// ----- Follow-ups (one responsible person and a date, always)

export const nextActionSchema = z.object({ action: required(500), owner: member, dueOn: day });

// ----- Proposals

export const proposalSchema = z
  .object({
    summary: text(2000),
    recommended_scope: text(6000),
    deliverables: text(4000),
    exclusions: text(4000),
    assumptions: text(4000),
    timeline_weeks_min: optInt(1, 520),
    timeline_weeks_max: optInt(1, 520),
    price_min: optMoney,
    price_max: optMoney,
    currency: optEnum(CURRENCIES),
    price_notes: text(1000),
  })
  .refine((v) => v.timeline_weeks_min === null || v.timeline_weeks_max === null || v.timeline_weeks_min <= v.timeline_weeks_max, { message: "timeline_range", path: ["timeline_weeks_max"] })
  .refine((v) => v.price_min === null || v.price_max === null || v.price_min <= v.price_max, { message: "price_range", path: ["price_max"] })
  .refine((v) => (v.price_min === null && v.price_max === null) || v.currency !== null, { message: "currency_required", path: ["currency"] });

export const proposalMove = z.enum(["internal_review", "draft", "approved", "sent", "accepted", "rejected", "withdrawn"]);

// ----- Projects

export const projectStatusSchema = z.enum(PROJECT_STATUSES);

// ----- Outreach

export const prospectSchema = z
  .object({
    company_name: required(160),
    website: text(300),
    country: text(80),
    sector: text(120),
    pool: optEnum(PROSPECT_POOLS),
    lead_origin: z.enum(["warm", "outbound", "referral", "partner"]),
    contact_name: text(120),
    contact_role: text(120),
    contact_channel: optEnum(CONTACT_CHANNELS),
    contact_handle: text(200),
    language: optEnum(["en", "ar"]),
    fit_tier: optEnum(FIT_TIERS),
    trigger_note: text(500),
    observation: text(1000),
    proof_case: text(300),
    fit_reason: text(1000),
    owner: member,
    do_not_contact: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
    ...Object.fromEntries(SCORE_KEYS.map((k) => [`score_${k}`, scoreValue])),
  })
  .transform((v) => {
    const rest = { ...(v as Record<string, unknown>) };
    const entries = SCORE_KEYS.map((k) => [k, rest[`score_${k}`] as string] as const).filter(([, s]) => s !== "");
    for (const k of SCORE_KEYS) delete rest[`score_${k}`];
    const score = entries.length === SCORE_KEYS.length ? Object.fromEntries(entries.map(([k, s]) => [k, Number(s)])) : entries.length === 0 ? null : undefined;
    return { ...rest, score } as Record<string, unknown> & { score: Record<string, number> | null | undefined; company_name: string; owner: string };
  })
  .refine((v) => v.score !== undefined, { message: "score_incomplete", path: ["score"] });

export const prospectStageSchema = z.object({
  stage: z.enum(PROSPECT_STAGES),
  reason: text(300),
  action: text(500),
  owner: z.union([z.literal(""), member]).transform((v) => (v === "" ? null : v)),
  dueOn: optDay,
});

export const touchSchema = z.object({
  kind: z.enum(TOUCH_KINDS),
  touchNo: z.union([z.literal(""), z.enum(["1", "2", "3", "4"])]).transform((v) => (v === "" ? null : Number(v))),
  channel: optEnum(CONTACT_CHANNELS),
  occurredOn: day,
  summary: required(500),
  action: text(500),
  owner: z.union([z.literal(""), member]).transform((v) => (v === "" ? null : v)),
  dueOn: optDay,
});

// ----- Reading the URL (filters and search)

const param = z.string().trim().max(120).catch("");
export const inquiryFiltersSchema = z.object({
  q: param,
  owner: z.string().regex(/^(unassigned|[a-z][a-z0-9-]{0,31})?$/).catch(""),
  stage: z.union([z.literal(""), z.enum(STAGES)]).catch(""),
  meeting: z.union([z.literal(""), z.enum(["not_booked", "booked", "cancelled", "completed", "no_show"])]).catch(""),
  preparation: z.union([z.literal(""), z.enum(["none", "queued", "running", "retry_scheduled", "succeeded", "failed", "paused", "manual"])]).catch(""),
  origin: z.union([z.literal(""), z.enum(LEAD_ORIGINS)]).catch(""),
  campaign: param,
  attention: z.union([z.literal(""), z.literal("1")]).catch(""),
});

export const dateRange = z
  .object({ from: day, to: day })
  .refine((r) => r.from <= r.to && (Date.parse(r.to) - Date.parse(r.from)) / 86_400_000 <= 800);

export const exportKind = z.enum(["inquiries", "companies", "contacts", "prospects"]);

// ----- Leads & Clients (the two-founder workflow)

export const PRIORITIES = ["high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const CONTRACT_STATUSES = ["not_started", "sent", "signed", "declined"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

// The commercial position, in the seven simple steps (Closed is Won or Lost).
export const positionSchema = z
  .object({
    position: z.enum(["new", "reviewing", "meeting", "qualified", "proposal", "decision", "won", "lost"]),
    reason: optEnum(LOSS_REASONS),
    note: text(500),
  })
  .refine((v) => v.position !== "lost" || v.reason !== null, { message: "loss_reason_required", path: ["reason"] });

// Pausing is a flag with a date to look again, not a stage. An empty date resumes.
export const pauseSchema = z.object({ pausedUntil: optDay });
export const prioritySchema = z.object({ priority: optEnum(PRIORITIES) });

// The deal: contract status and reference (no e-signature), commercial notes.
export const dealSchema = z
  .object({
    contract_status: optEnum(CONTRACT_STATUSES),
    contract_signed_on: optDay,
    contract_reference: text(200),
    commercial_notes: text(4000),
  })
  .refine((v) => v.contract_status !== "signed" || v.contract_signed_on !== null, { message: "signed_date_required", path: ["contract_signed_on"] });

export const leadFiltersSchema = z.object({
  q: z.string().trim().max(120).catch(""),
  owner: z.string().regex(/^(unassigned|[a-z][a-z0-9-]{0,31})?$/).catch(""),
  stage: z.union([z.literal(""), z.enum(["new", "reviewing", "meeting", "qualified", "proposal", "decision", "closed"])]).catch(""),
  priority: z.union([z.literal(""), z.enum(PRIORITIES)]).catch(""),
  paused: z.union([z.literal(""), z.enum(["yes", "no"])]).catch(""),
});

export const settingsSchema = z.object({ default_owner: z.union([z.literal(""), member]) });

// Turns a posted form into a plain object of strings, one entry per field.
export function formObject(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of form.entries()) if (typeof value === "string" && !(key in out)) out[key] = value;
  return out;
}

// Only http(s) links are ever rendered as links; anything else shows as text.
export function safeHref(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
