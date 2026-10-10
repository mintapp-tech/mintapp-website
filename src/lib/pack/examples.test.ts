import { describe, expect, test } from "vitest";
import { DESIGN_EXAMPLES } from "./examples";
import { PATTERNS, type PatternId } from "./patterns";
import { designProblems, renderableDesign } from "./schema";

describe("the design library's synthetic examples", () => {
  test("cover a service website, a marketplace, an operations dashboard, a booking app, a mobile app and an Arabic design", () => {
    const patterns = DESIGN_EXAMPLES.map((e) => e.design.blueprint.pattern);
    expect(patterns).toEqual(expect.arrayContaining(["studio_site", "marketplace_site", "operations_app", "scheduling_app", "mobile_app"]));
    expect(DESIGN_EXAMPLES.some((e) => e.design.language === "ar")).toBe(true);
  });

  test.each(DESIGN_EXAMPLES.map((e) => [e.id, e] as const))("%s is a valid library design that the renderer draws", (_id, e) => {
    expect(renderableDesign(e.design)).not.toBeNull();
    const kind = PATTERNS[e.design.blueprint.pattern as PatternId].kind;
    expect(designProblems({ design_blueprint: e.design.blueprint, screens: e.design.screens, user_flow: e.design.user_flow }, { brief: "", language: e.design.language, projectType: kind })).toEqual([]);
    expect(e.design.screens.length).toBeGreaterThanOrEqual(2);
    expect(e.design.screens.length).toBeLessThanOrEqual(4);
  });
});
