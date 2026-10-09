import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import DesignPreview, { type DesignLabels } from "./DesignPreview";
import { TEMPLATE_COMPONENTS } from "./templates";
import { PATTERNS, PATTERN_IDS, TEMPLATE_IDS } from "@/lib/pack/patterns";
import { renderableDesign, splitPack } from "@/lib/pack/schema";
import { clinicPack } from "@/lib/pack/test-fixtures";

const labels: DesignLabels = {
  pattern: "Pattern",
  audience: "Audience",
  goal: "Goal",
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
const render = (design: ReturnType<typeof splitPack>["design"]) => renderToStaticMarkup(<DesignPreview design={design} labels={labels} locale="en" />);

describe("the initial-design renderer", () => {
  test("every template id has exactly one trusted component", () => {
    expect(Object.keys(TEMPLATE_COMPONENTS).sort()).toEqual([...TEMPLATE_IDS].sort());
  });

  test("every pattern renders with each of its templates, on desktop and phone", () => {
    for (const id of PATTERN_IDS) {
      const pattern = PATTERNS[id];
      const screens = pattern.templates.slice(0, 4).map((template, i) => ({ ...clinicPack().screens[0], id: `s${i + 1}`, template, items: [{ title: "Item", text: "Text" }] }));
      const design = { ...splitPack(clinicPack()).design, blueprint: { ...clinicPack().design_blueprint, pattern: id }, screens, user_flow: screens.map((s) => ({ step: "Step", screen: s.id })) };
      const html = render(design);
      for (const t of pattern.templates.slice(0, 4)) expect(html, `${id} ${t}`).toContain(`data-screen="${t}"`);
      expect(html).toContain(pattern.kind === "mobile_app" ? "Phone" : "Desktop");
    }
  });

  test("text from a model is only ever text: markup and script are escaped, never interpreted", () => {
    const evil = '<script>alert(1)</script><img src=x onerror="alert(1)"> javascript:alert(1)';
    const design = splitPack(clinicPack()).design;
    design.screens[0] = { ...design.screens[0], headline: evil, primary_action: "<a href='javascript:alert(1)'>go</a>", items: [{ title: evil, text: evil }] };
    const html = render(design);
    expect(html).not.toContain("<script>");
    expect(html).not.toMatch(/<img|<a /);
    expect(html).not.toMatch(/<[^>]+onerror=/);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  test("an Arabic design is drawn right to left, in its device frames", () => {
    const design = { ...splitPack(clinicPack()).design, language: "ar" as const };
    expect(render(design)).toContain('dir="rtl"');
  });

  test("the renderer never uses raw HTML injection and loads no external asset", () => {
    for (const file of ["templates.tsx", "DesignPreview.tsx"]) {
      const source = readFileSync(join(__dirname, file), "utf8");
      expect(source, file).not.toMatch(/dangerouslySetInnerHTML|eval\(|new Function|<img|<iframe|<script/);
      expect(source, file).not.toMatch(/https?:\/\//);
    }
  });

  test("a stored design that fails the library check is not drawn at all", () => {
    expect(renderableDesign({ ...splitPack(clinicPack()).design, screens: [{ ...clinicPack().screens[0], template: "hero" }] })).toBeNull();
  });
});
