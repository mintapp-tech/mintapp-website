import { describe, expect, test } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildGenerationInput } from "@/lib/preparation/input";
import { simpleStage, SIMPLE_STAGES } from "@/lib/crm/simple-stages";
import { directionPack } from "@/lib/pack/presentation";
import { validateArtifact } from "@/lib/pack/schema";
import { SEED_ADAM, SEED_DOMAIN, SEED_LEADS, SEED_OMAR, SEED_PROSPECTS, seedId } from "./data";
import { seedSql, sqlText } from "./sql";

// The curated review dataset. UPDATE_REVIEW_SEED=1 (npm run review:seed) rewrites
// supabase/review/seed_curated.sql; otherwise this checks it is up to date.
const file = join(process.cwd(), "supabase", "review", "seed_curated.sql");
const normal = (s: string) => s.replace(/\r\n/g, "\n");
const ctxOf = (n: number) => {
  const l = SEED_LEADS.find((x) => x.n === n)!;
  const input = buildGenerationInput({ preferred_language: l.lang, project_type: l.projectType, project_description: l.description, budget_range: l.budget?.range ?? null, budget_currency: l.budget?.currency ?? null, timeline: l.timeline, country: l.country });
  return { brief: input.brief, language: input.language, projectType: input.projectType };
};

describe("the curated review seed", () => {
  if (process.env.UPDATE_REVIEW_SEED === "1") {
    test("is written from data.ts", () => writeFileSync(file, seedSql()));
    return;
  }

  test("the committed SQL is what data.ts produces, and it is ASCII-only", () => {
    const committed = normal(readFileSync(file, "utf8"));
    expect(committed).toBe(normal(seedSql()));
    expect(/[^\x09\x0a\x0d\x20-\x7e]/.test(committed)).toBe(false);
  });

  test("one example for every workflow position the application has, and the stage model is the application's own", () => {
    const final = new Set(SEED_LEADS.map((l) => simpleStage(l.stages.at(-1) ?? "new")));
    expect([...final].sort()).toEqual([...SIMPLE_STAGES].sort());
    const known = ["new", "reviewing", "meeting_booked", "preparing", "meeting_ready", "meeting_completed", "qualified", "proposal_prep", "proposal_sent", "negotiation", "won", "lost"];
    for (const l of SEED_LEADS) for (const s of l.stages) expect(known, `${l.n} ${s}`).toContain(s);
  });

  test("readable names, no timestamps, no real contact details; English and Arabic; with and without a company; inbound and outbound", () => {
    for (const l of SEED_LEADS) {
      expect(l.name).not.toMatch(/\d/);
      expect(l.company ?? "").not.toMatch(/\d{4,}/);
      expect(l.email.endsWith(`@${SEED_DOMAIN}`)).toBe(true);
      expect(l.description).not.toMatch(/@|https?:|\+?\d[\d\s-]{7,}/);
    }
    expect(new Set(SEED_LEADS.map((l) => l.lang))).toEqual(new Set(["en", "ar"]));
    expect(SEED_LEADS.some((l) => l.company) && SEED_LEADS.some((l) => !l.company)).toBe(true);
    expect(SEED_PROSPECTS.some((p) => p.linksTo)).toBe(true);
    expect(seedSql()).not.toMatch(/review@example\.com|e2e-|review-run|crm_set_setting|default_owner/);
  });

  test("every Pack version in the seed passes the application's validator against its own brief", () => {
    for (const l of SEED_LEADS) {
      for (const v of l.versions ?? []) {
        const r = validateArtifact(v.artifact, v.content, ctxOf(l.n));
        expect(r.ok ? [] : r.problems, `${l.n} ${v.artifact}`).toEqual([]);
      }
    }
  });

  test("the complete case ends with a presentable Direction Pack; the Arabic case is in review and not yet presentable", () => {
    const drafts = (n: number) => {
      const l = SEED_LEADS.find((x) => x.n === n)!;
      const rows = (l.versions ?? []).map((v, i) => ({ artifact: v.artifact, version: i + 1, review_status: v.reviews.at(-1)?.to ?? "draft", content: v.content, reviewed_by: v.reviews.at(-1)?.by ?? null, reviewed_at: null }));
      return rows;
    };
    const lotus = directionPack(drafts(9), ctxOf(9), "approved");
    expect(lotus.ok).toBe(true);
    expect(lotus.ok && lotus.source.versions).toEqual({ design: 4, proposal: 2, discovery: 3 });
    expect(directionPack(drafts(5), ctxOf(5), "approved").ok).toBe(false);
    expect(directionPack(drafts(5), ctxOf(5), "preview").ok).toBe(true);
    // Every approval is by the founder who did not write that version.
    for (const l of SEED_LEADS) for (const v of l.versions ?? []) for (const r of v.reviews) if (r.to === "approved") expect(r.by, `${l.n}`).not.toBe(v.author);
    expect([SEED_OMAR, SEED_ADAM].every((a) => a.endsWith(SEED_DOMAIN))).toBe(true);
  });

  test("ids are fixed and inside the seed's own range", () => {
    expect(seedId(9)).toBe("5eed0000-0000-4000-8000-000000000009");
    expect(sqlText("it's")).toBe("'it''s'");
    expect(sqlText("مخبز!")).toBe("U&'!0645!062e!0628!0632!!' UESCAPE '!'");
  });
});
