import { describe, expect, test } from "vitest";
import { DESIGN_EXAMPLES } from "./examples";
import { PATTERNS, PATTERN_IDS, TEMPLATE_IDS, type PatternId } from "./library";
import { designProblems, proseProblems, renderableDesign } from "./schema";

describe("the design library's synthetic examples", () => {
  test("one example for every product pattern, every template but proof drawn somewhere, and an Arabic design", () => {
    expect(DESIGN_EXAMPLES.map((e) => e.design.blueprint.pattern).sort()).toEqual([...PATTERN_IDS].sort());
    const used = new Set(DESIGN_EXAMPLES.flatMap((e) => e.design.screens.map((s) => s.template)));
    // Proof points need the client's own evidence, which an invented business does not have.
    expect(TEMPLATE_IDS.filter((t) => !used.has(t))).toEqual(["proof"]);
    expect(DESIGN_EXAMPLES.some((e) => e.design.language === "ar")).toBe(true);
  });

  test.each(DESIGN_EXAMPLES.map((e) => [e.id, e] as const))("%s is a valid library design that the renderer draws, with no invented figure or claim", (_id, e) => {
    expect(renderableDesign(e.design)).not.toBeNull();
    const kind = PATTERNS[e.design.blueprint.pattern as PatternId].kind;
    const ctx = { brief: "", language: e.design.language, projectType: kind };
    expect(designProblems({ design_blueprint: e.design.blueprint, screens: e.design.screens, user_flow: e.design.user_flow }, ctx)).toEqual([]);
    expect(proseProblems({ blueprint: e.design.blueprint, screens: e.design.screens, user_flow: e.design.user_flow }, ctx)).toEqual([]);
  });
});
