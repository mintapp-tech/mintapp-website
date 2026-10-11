import { describe, expect, test } from "vitest";
import { buildGenerationInput } from "@/lib/preparation/input";
import { SYNTHETIC_BRIEFS } from "@/lib/preparation/synthetic-briefs";
import { PRESENTATION_COPY } from "./presentation-copy";
import { directionPack, type DraftLike } from "./presentation";
import { STAGE, buildSlides, itemHeight, paginate } from "./slides";
import { splitPack, type Pack } from "./schema";
import { clinicPack } from "./test-fixtures";

const input = buildGenerationInput(SYNTHETIC_BRIEFS[0].inquiry);
const ctx = { brief: input.brief, language: input.language, projectType: input.projectType };

function drafts(pack: Pack, status: Record<string, string> = {}, extra: DraftLike[] = []): DraftLike[] {
  const parts = splitPack(pack);
  return [
    { artifact: "design", version: 1, review_status: status.design ?? "approved", content: parts.design, reviewed_by: "adam@x", reviewed_at: "2026-10-10T10:00:00Z" },
    { artifact: "proposal", version: 2, review_status: status.proposal ?? "approved", content: parts.proposal, reviewed_by: "omar@x", reviewed_at: "2026-10-11T09:00:00Z" },
    { artifact: "discovery", version: 3, review_status: status.discovery ?? "approved", content: parts.discovery, reviewed_by: "adam@x", reviewed_at: "2026-10-10T12:00:00Z" },
    ...extra,
  ];
}

describe("whether the Direction Pack can be shown", () => {
  test("three approved, valid parts make a presentation, labelled with their versions and approval", () => {
    const r = directionPack(drafts(clinicPack()), ctx, "approved");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.source.versions).toEqual({ design: 1, proposal: 2, discovery: 3 });
    expect(r.source.approvedAt).toBe("2026-10-11T09:00:00Z");
    expect(r.source.approvedBy.sort()).toEqual(["adam@x", "omar@x"]);
    expect(r.source.pack).toEqual(clinicPack());
  });

  test("never from an unapproved part; the preview shows the latest versions instead", () => {
    const d = drafts(clinicPack(), { proposal: "in_review" });
    expect(directionPack(d, ctx, "approved")).toEqual({ ok: false, blockers: [{ part: "proposal", reason: "not_approved" }] });
    expect(directionPack(d, ctx, "preview").ok).toBe(true);
    expect(directionPack(drafts(clinicPack()).filter((x) => x.artifact !== "discovery"), ctx, "approved")).toEqual({ ok: false, blockers: [{ part: "discovery", reason: "missing" }] });
  });

  test("an approved version is used even when a newer draft exists, and says so", () => {
    const newer = { ...drafts(clinicPack())[1], version: 9, review_status: "draft" };
    const r = directionPack(drafts(clinicPack(), {}, [newer]), ctx, "approved");
    expect(r.ok && r.source.versions.proposal).toBe(2);
    expect(r.ok && r.source.newerDraft).toBe(true);
  });

  test("placeholder text, a hand-made design, an older format or a version that no longer passes the checks block presenting", () => {
    expect(directionPack(drafts(clinicPack({ next_steps: ["[MOCK] next"] })), ctx, "approved")).toEqual({ ok: false, blockers: [{ part: "discovery", reason: "placeholder" }] });
    const hand = clinicPack({ design_blueprint: { ...clinicPack().design_blueprint, pattern: null, unsupported_reason: "Hardware." }, screens: [], user_flow: [] });
    expect(directionPack(drafts(hand), ctx, "approved")).toEqual({ ok: false, blockers: [{ part: "design", reason: "hand_design" }] });
    const legacy = drafts(clinicPack()).map((x) => (x.artifact === "proposal" ? { ...x, content: { format: "text", body: "notes" } } : x));
    expect(directionPack(legacy, ctx, "approved")).toEqual({ ok: false, blockers: [{ part: "proposal", reason: "legacy" }] });
    expect(directionPack(drafts(clinicPack()), { ...ctx, language: "ar" }, "approved")).toMatchObject({ ok: false, blockers: [{ part: "design", reason: "invalid" }, { part: "proposal", reason: "invalid" }, { part: "discovery", reason: "invalid" }] });
  });
});

describe("the slides", () => {
  test("follow the agreed order, from the cover to the agenda", () => {
    const slides = buildSlides(clinicPack());
    const c = PRESENTATION_COPY.en.slides;
    const titles = slides.map((s) => (s.kind === "cover" ? "cover" : s.title));
    expect(titles).toEqual(["cover", c.understood, c.people, c.factsAssumptions, c.direction, c.screen(1, 2), c.screen(2, 2), c.flow, c.scope, c.proposal, c.proposal, c.questions, c.risks, c.agenda]);
    // The proposal direction always carries the not-final banner.
    expect(slides.filter((s) => s.kind === "columns" && s.title === c.proposal).every((s) => s.kind === "columns" && s.banner)).toBe(true);
  });

  test("facts and assumptions stay labelled on the slides", () => {
    const understood = buildSlides(clinicPack()).find((s) => s.kind === "columns" && s.title === PRESENTATION_COPY.en.slides.understood);
    expect(understood && understood.kind === "columns" && understood.columns[0].items.map((i) => i.tag)).toEqual(["client_fact", "assumption"]);
  });

  test("a list too long for one slide continues on the next, never clipped, in both languages", () => {
    const long = "A long statement about how the clinics work today and what they would like to change, written to the length limit for this field. ".repeat(3).slice(0, 300);
    const facts = Array.from({ length: 12 }, () => ({ text: long, evidence: "Patients book by phone" }));
    const slides = buildSlides(clinicPack({ client_facts: facts }));
    const factSlides = slides.filter((s) => s.kind === "columns" && s.title === PRESENTATION_COPY.en.slides.factsAssumptions);
    expect(factSlides.length).toBeGreaterThan(1);
    expect(factSlides.slice(1).every((s) => s.kind === "columns" && s.continued)).toBe(true);
    expect(factSlides.flatMap((s) => (s.kind === "columns" ? s.columns[0]?.items ?? [] : []))).toHaveLength(12);
    for (const lang of ["en", "ar"] as const) {
      for (const page of paginate(facts.map((f) => ({ text: f.text })), 352, 390, lang)) {
        expect(page.reduce((h, i) => h + itemHeight(i, 352, lang), 0) <= 390 || page.length === 1).toBe(true);
      }
    }
    expect(STAGE).toEqual({ width: 1280, height: 720 });
  });

  test("an Arabic Pack gets Arabic slide titles", () => {
    const arabic = buildSlides({ ...clinicPack(), language: "ar" });
    expect(arabic.some((s) => s.kind === "direction" && s.title === "الاتجاه المبدئي للمنتج")).toBe(true);
  });
});
