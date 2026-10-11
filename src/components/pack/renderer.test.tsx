import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import DesignPreview, { type DesignLabels } from "./DesignPreview";
import { TEMPLATE_COMPONENTS } from "./templates";
import { PATTERNS, PATTERN_IDS, TEMPLATE_IDS } from "@/lib/pack/library";
import { renderableDesign, splitPack } from "@/lib/pack/schema";
import { clinicPack } from "@/lib/pack/test-fixtures";

const labels: DesignLabels = {
  pattern: "Pattern",
  audience: "Audience",
  goal: "Goal",
  direction: "Direction",
  hierarchy: "Hierarchy",
  responsive: "Responsive",
  brand: "Brand",
  flow: "Flow",
  screen: (n) => `Screen ${n}`,
  desktop: "Desktop",
  phone: "Phone",
  placeholder: "Image placeholder",
  notFinal: "Initial direction, not a final design.",
};
const render = (content: unknown) => renderToStaticMarkup(<DesignPreview design={renderableDesign(content)!} labels={labels} locale="en" />);

describe("the concept renderer", () => {
  test("every template id has exactly one trusted component", () => {
    expect(Object.keys(TEMPLATE_COMPONENTS).sort()).toEqual([...TEMPLATE_IDS].sort());
  });

  test("every pattern renders with each of its templates, on desktop and phone, with its kind of navigation", () => {
    for (const id of PATTERN_IDS) {
      const pattern = PATTERNS[id];
      for (let from = 0; from < pattern.templates.length; from += 4) {
        const screens = pattern.templates.slice(from, from + 4).map((template, i) => ({ ...clinicPack().screens[0], id: `s${i + 1}`, template, items: [{ title: "Item", text: "Text" }] }));
        if (screens.length < 2) screens.unshift({ ...screens[0], id: "s2" });
        const design = { ...splitPack(clinicPack()).design, blueprint: { ...clinicPack().design_blueprint, pattern: id }, screens, user_flow: screens.map((s) => ({ step: "Step", screen: s.id })) };
        const html = render(design);
        for (const s of screens) expect(html, `${id} ${s.template}`).toContain(`data-screen="${s.template}"`);
        expect(html).toContain(pattern.kind === "mobile_app" ? "Phone" : "Desktop");
      }
    }
  });

  test("charts and tiles never draw a value: a trend shows measures and placeholder bars only", () => {
    const screens = [
      { ...clinicPack().screens[0], id: "s1", template: "trend_report" as const, items: [{ title: "On time", text: "Delivered in the window." }] },
      { ...clinicPack().screens[0], id: "s2", template: "overview_dashboard" as const, items: [{ title: "Delayed", text: "Past the window." }] },
    ];
    const html = render({ ...splitPack(clinicPack()).design, blueprint: { ...clinicPack().design_blueprint, pattern: "dashboard_app" }, screens, user_flow: [{ step: "a", screen: "s1" }, { step: "b", screen: "s2" }] });
    const visibleText = html.replace(/<[^>]+>/g, " ");
    expect(visibleText).not.toMatch(/\d+\s*%|\$\s*\d/);
  });

  test("text from a model is only ever text: markup and script are escaped, never interpreted", () => {
    const evil = '<script>alert(1)</script><img src=x onerror="alert(1)"> javascript:alert(1)';
    const design = splitPack(clinicPack()).design;
    design.screens[0] = { ...design.screens[0], headline: evil, primary_action: "<a href='javascript:alert(1)'>go</a>", items: [{ title: "<script>alert(1)</script>", text: evil }] };
    const html = render(design);
    expect(html).not.toContain("<script>");
    expect(html).not.toMatch(/<img|<a /);
    expect(html).not.toMatch(/<[^>]+onerror=/);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  test("an Arabic design is drawn right to left, in its device frames", () => {
    expect(render({ ...splitPack(clinicPack()).design, language: "ar" })).toContain('dir="rtl"');
  });

  test("the renderer and the Direction Pack never inject raw HTML and load no external asset", () => {
    for (const file of ["templates.tsx", "DesignPreview.tsx", "DirectionPack.tsx", "DeckControls.tsx"]) {
      const source = readFileSync(join(__dirname, file), "utf8");
      expect(source, file).not.toMatch(/dangerouslySetInnerHTML|eval\(|new Function|<img|<iframe|<script/);
      expect(source, file).not.toMatch(/https?:\/\//);
    }
  });

  test("a stored design that fails the library check is not drawn at all", () => {
    expect(renderableDesign({ ...splitPack(clinicPack()).design, screens: [{ ...clinicPack().screens[0], template: "hero" }] })).toBeNull();
  });
});
