import { describe, expect, test } from "vitest";
import { attentionReasons } from "./attention";
import { EXPORT_COLUMNS, safeCell, toCsv } from "./csv";
import { companySchema, contactSchema, dateRange, detailsSchema, inquiryFiltersSchema, nextActionSchema, proposalSchema, prospectSchema, safeHref, stageSchema, touchSchema } from "./schemas";
import { BOARD_GROUPS, isOpenStage, stageRank } from "./stages";
import { STAGES, type InquiryListRow } from "./types";

const row = (over: Partial<InquiryListRow> = {}): InquiryListRow => ({
  id: "11111111-1111-4111-8111-111111111111",
  created_at: "2026-10-01T10:00:00Z",
  client_name: "Client",
  company_name: null,
  crm_company: null,
  language: "en",
  project_type: null,
  summary: "",
  booking_status: "not_booked",
  meeting_start_at: null,
  lead_status: "new",
  stage_changed_at: "2026-10-01T10:00:00Z",
  owners: ["omar"],
  next_follow_up: { action: "Send questions", owner: "omar", due_on: "2026-10-20" },
  open_follow_ups: 1,
  preparation_status: "manual",
  preparation_error: null,
  latest_draft: null,
  approved_version: null,
  lead_origin: "inbound",
  source: null,
  campaign: null,
  fit_tier: null,
  lead_score: null,
  proposal_status: null,
  ...over,
});
const OPTS = { today: "2026-10-09", automationEnabled: false, now: new Date("2026-10-09T10:00:00Z") };

describe("pipeline stages", () => {
  test("there are exactly thirteen, in the order the team works them, and the board shows each once", () => {
    expect(STAGES).toHaveLength(13);
    expect(STAGES.slice(0, 2)).toEqual(["new", "reviewing"]);
    expect(BOARD_GROUPS.flatMap((g) => g.stages).sort()).toEqual([...STAGES].sort());
  });
  test("won, lost and paused are outcomes, not open work; the main path has ranks", () => {
    for (const s of ["won", "lost", "paused"]) expect(isOpenStage(s)).toBe(false);
    for (const s of STAGES.filter((x) => !["won", "lost", "paused"].includes(x))) expect(isOpenStage(s)).toBe(true);
    expect(stageRank("qualified")).toBeGreaterThan(stageRank("meeting_completed")!);
    expect(stageRank("lost")).toBeNull();
  });
});

describe("what needs attention", () => {
  test("a well-run inquiry needs nothing", () => {
    expect(attentionReasons(row(), OPTS)).toEqual([]);
  });
  test("no owner and no next action are flagged for open work only", () => {
    expect(attentionReasons(row({ owners: [], next_follow_up: null }), OPTS)).toEqual(["no_owner", "no_next_action"]);
    expect(attentionReasons(row({ owners: [], next_follow_up: null, lead_status: "won" }), OPTS)).toEqual([]);
    expect(attentionReasons(row({ owners: [], next_follow_up: null, lead_status: "paused" }), OPTS)).toEqual([]);
  });
  test("a follow-up due before today is overdue; due today is not", () => {
    expect(attentionReasons(row({ next_follow_up: { action: "x", owner: "adam", due_on: "2026-10-08" } }), OPTS)).toEqual(["overdue_follow_up"]);
    expect(attentionReasons(row({ next_follow_up: { action: "x", owner: "adam", due_on: "2026-10-09" } }), OPTS)).toEqual([]);
  });
  test("failed, paused, missing and waiting-with-automation-off preparation is flagged; manual and succeeded are not", () => {
    for (const s of ["failed", "paused", null]) expect(attentionReasons(row({ preparation_status: s }), OPTS)).toEqual(["preparation"]);
    expect(attentionReasons(row({ preparation_status: "queued" }), OPTS)).toEqual(["preparation"]);
    expect(attentionReasons(row({ preparation_status: "queued" }), { ...OPTS, automationEnabled: true })).toEqual([]);
    for (const s of ["manual", "succeeded"]) expect(attentionReasons(row({ preparation_status: s }), OPTS)).toEqual([]);
  });
  test("a booked meeting still ahead without an approved note needs approval; a cancelled one does not", () => {
    const booked = row({ booking_status: "booked", meeting_start_at: "2026-10-12T09:00:00Z" });
    expect(attentionReasons(booked, OPTS)).toEqual(["needs_approval"]);
    expect(attentionReasons({ ...booked, approved_version: 1 }, OPTS)).toEqual([]);
    expect(attentionReasons({ ...booked, booking_status: "cancelled" }, OPTS)).toEqual([]);
  });
});

describe("CSV export", () => {
  test("text that a spreadsheet would run as a formula is made text", () => {
    const evil = ['=HYPERLINK("http://evil","x")', "+1+1", "-2+3", "@SUM(A1)", "\t=1", "\r=1", "  =1+1", "=cmd|' /C calc'!A0"];
    for (const text of evil) expect(safeCell(text)).toBe(`'${text}`);
  });
  test("ordinary text, Arabic, numbers, booleans, lists and empty values are unchanged", () => {
    expect(safeCell("Nile Clinics")).toBe("Nile Clinics");
    expect(safeCell("عيادات النيل")).toBe("عيادات النيل");
    expect(safeCell(12)).toBe("12");
    expect(safeCell(-5)).toBe("-5");
    expect(safeCell(true)).toBe("yes");
    expect(safeCell(["omar", "adam"])).toBe("omar & adam");
    expect(safeCell(null)).toBe("");
    expect(safeCell(undefined)).toBe("");
  });
  test("a CSV has a BOM, CRLF lines, quoted commas, quotes and newlines, and dates from the database untouched", () => {
    const csv = toCsv(["a", "b", "c"], [{ a: "x,y", b: 'say "hi"', c: "2026-10-09T10:00:00+00:00" }, { a: "line1\nline2", b: "=1+1", c: null }]);
    expect(csv.startsWith("﻿a,b,c\r\n")).toBe(true);
    expect(csv).toContain('"x,y","say ""hi""",2026-10-09T10:00:00+00:00\r\n');
    expect(csv).toContain('"line1\nline2",\'=1+1,\r\n');
    expect(csv.endsWith("\r\n")).toBe(true);
  });
  test("a formula hidden in a client's name or a note cannot survive an export", () => {
    const csv = toCsv(EXPORT_COLUMNS.inquiries, [{ client: "=cmd|' /C calc'!A0", company: "@evil", next_action: "-1+1" }]);
    expect(csv).not.toMatch(/(^|,)[=@+-]/m);
  });
  test("every export has a fixed column list", () => {
    expect(Object.keys(EXPORT_COLUMNS).sort()).toEqual(["companies", "contacts", "inquiries", "prospects"]);
  });
});

describe("validation", () => {
  test("a company needs a name; empty fields clear; the language is en or ar", () => {
    expect(companySchema.safeParse({ name: "  ", website: "", country: "", sector: "", language: "" }).success).toBe(false);
    expect(companySchema.parse({ name: " Nile ", website: "", country: "Egypt", sector: "", language: "ar" })).toEqual({ name: "Nile", website: null, country: "Egypt", sector: null, language: "ar" });
    expect(companySchema.safeParse({ name: "X", website: "", country: "", sector: "", language: "fr" }).success).toBe(false);
  });
  test("a contact: lower-cased email, phone characters only, a consent status from the list", () => {
    const base = { full_name: "Mona", role_title: "", email: " MONA@Example.Test ", phone: "+20 100-000", preferred_language: "", consent_status: "not_recorded" };
    expect(contactSchema.parse(base)).toMatchObject({ email: "mona@example.test", phone: "+20 100-000", do_not_contact: false });
    expect(contactSchema.safeParse({ ...base, phone: "call me" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...base, email: "not an email" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...base, consent_status: "yes" }).success).toBe(false);
    expect(contactSchema.parse({ ...base, do_not_contact: "on" }).do_not_contact).toBe(true);
  });
  test("a lead score is all seven categories or none, each 0 to 2", () => {
    const empty = { lead_origin: "", referral_partner: "", campaign: "", content_id: "", fit_tier: "", trigger_note: "", research_note: "" };
    const all = { score_trigger: "2", score_problem: "1", score_access: "0", score_proof: "2", score_timing: "1", score_commercial: "2", score_geo: "2" };
    expect(detailsSchema.parse({ ...empty, ...all }).score).toEqual({ trigger: 2, problem: 1, access: 0, proof: 2, timing: 1, commercial: 2, geo: 2 });
    expect(detailsSchema.parse({ ...empty }).score).toBeNull();
    expect(detailsSchema.safeParse({ ...empty, score_trigger: "2" }).success).toBe(false);
    expect(detailsSchema.safeParse({ ...empty, ...all, score_geo: "3" }).success).toBe(false);
    expect(detailsSchema.safeParse({ ...empty, lead_origin: "cold" }).success).toBe(false);
  });
  test("losing a deal needs a reason from the list", () => {
    expect(stageSchema.safeParse({ stage: "lost", reason: "", note: "", pausedUntil: "" }).success).toBe(false);
    expect(stageSchema.safeParse({ stage: "lost", reason: "because", note: "", pausedUntil: "" }).success).toBe(false);
    expect(stageSchema.parse({ stage: "lost", reason: "no_budget", note: "", pausedUntil: "" })).toMatchObject({ reason: "no_budget", note: null });
    expect(stageSchema.safeParse({ stage: "converted", reason: "", note: "", pausedUntil: "" }).success).toBe(false);
    expect(stageSchema.parse({ stage: "paused", reason: "", note: "", pausedUntil: "2026-12-01" }).pausedUntil).toBe("2026-12-01");
    expect(stageSchema.safeParse({ stage: "paused", reason: "", note: "", pausedUntil: "2026-02-31" }).success).toBe(false);
  });
  test("a next action has an action, one responsible member and a real date", () => {
    expect(nextActionSchema.safeParse({ action: "Send questions", owner: "adam", dueOn: "2026-10-12" }).success).toBe(true);
    expect(nextActionSchema.safeParse({ action: "", owner: "adam", dueOn: "2026-10-12" }).success).toBe(false);
    expect(nextActionSchema.safeParse({ action: "x", owner: "omar,adam", dueOn: "2026-10-12" }).success).toBe(false);
    expect(nextActionSchema.safeParse({ action: "x", owner: "adam", dueOn: "" }).success).toBe(false);
    expect(nextActionSchema.safeParse({ action: "x", owner: "adam", dueOn: "12/10/2026" }).success).toBe(false);
  });
  test("a proposal: ranges must make sense and a price needs a currency", () => {
    const base = { summary: "", recommended_scope: "", deliverables: "", exclusions: "", assumptions: "", timeline_weeks_min: "", timeline_weeks_max: "", price_min: "", price_max: "", currency: "", price_notes: "" };
    expect(proposalSchema.safeParse(base).success).toBe(true);
    expect(proposalSchema.safeParse({ ...base, price_min: "100" }).success).toBe(false);
    expect(proposalSchema.parse({ ...base, price_min: "100.50", price_max: "200", currency: "USD" })).toMatchObject({ price_min: 100.5, price_max: 200, currency: "USD" });
    expect(proposalSchema.safeParse({ ...base, price_min: "300", price_max: "200", currency: "USD" }).success).toBe(false);
    expect(proposalSchema.safeParse({ ...base, timeline_weeks_min: "12", timeline_weeks_max: "8" }).success).toBe(false);
    expect(proposalSchema.safeParse({ ...base, timeline_weeks_min: "0" }).success).toBe(false);
    expect(proposalSchema.safeParse({ ...base, price_min: "-5", currency: "USD" }).success).toBe(false);
    expect(proposalSchema.safeParse({ ...base, currency: "XYZ" }).success).toBe(false);
    expect(proposalSchema.safeParse({ ...base, summary: "x".repeat(2001) }).success).toBe(false);
  });
  test("a prospect: owner is one member id; a partial score is refused", () => {
    const base = { company_name: "Acme", website: "", country: "UAE", sector: "", pool: "trigger_startup", lead_origin: "outbound", contact_name: "", contact_role: "", contact_channel: "", contact_handle: "", language: "", fit_tier: "", trigger_note: "", observation: "", proof_case: "", fit_reason: "", owner: "omar" };
    expect(prospectSchema.safeParse(base).success).toBe(true);
    expect(prospectSchema.safeParse({ ...base, owner: "omar & adam" }).success).toBe(false);
    expect(prospectSchema.safeParse({ ...base, score_trigger: "1" }).success).toBe(false);
    expect(prospectSchema.safeParse({ ...base, pool: "random" }).success).toBe(false);
  });
  test("an outreach touch: the four numbered touches, a channel from the list, a summary", () => {
    const base = { kind: "outbound", touchNo: "1", channel: "linkedin", occurredOn: "2026-10-09", summary: "Observation about the seed round", action: "", owner: "", dueOn: "" };
    expect(touchSchema.parse(base)).toMatchObject({ touchNo: 1, owner: null, dueOn: null });
    expect(touchSchema.safeParse({ ...base, touchNo: "5" }).success).toBe(false);
    expect(touchSchema.safeParse({ ...base, summary: "" }).success).toBe(false);
    expect(touchSchema.safeParse({ ...base, channel: "telegram" }).success).toBe(false);
  });
  test("filters in the address bar are cleaned, never trusted", () => {
    expect(inquiryFiltersSchema.parse({ q: " bravo ", owner: "adam", stage: "qualified", meeting: "booked", preparation: "failed", origin: "referral", campaign: "c", attention: "1" })).toMatchObject({ q: "bravo", owner: "adam", stage: "qualified", attention: "1" });
    expect(inquiryFiltersSchema.parse({ stage: "<script>", owner: "A B", meeting: "x", origin: "cold", attention: "yes", q: "x".repeat(500) })).toMatchObject({ stage: "", owner: "", meeting: "", origin: "", attention: "", q: "" });
    expect(inquiryFiltersSchema.parse({ owner: "unassigned" }).owner).toBe("unassigned");
  });
  test("a date range is ordered and bounded", () => {
    expect(dateRange.safeParse({ from: "2026-10-01", to: "2026-10-09" }).success).toBe(true);
    expect(dateRange.safeParse({ from: "2026-10-09", to: "2026-10-01" }).success).toBe(false);
    expect(dateRange.safeParse({ from: "2020-01-01", to: "2026-10-01" }).success).toBe(false);
  });
  test("only http(s) websites become links", () => {
    expect(safeHref("acme.test")).toBe("https://acme.test/");
    expect(safeHref("http://acme.test/a")).toBe("http://acme.test/a");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,x")).toBeNull();
    expect(safeHref("")).toBeNull();
    expect(safeHref(null)).toBeNull();
  });
});
