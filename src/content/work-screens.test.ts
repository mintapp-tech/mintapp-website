import { describe, expect, test } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { WORK_SCREENS, type ScreenAsset } from "./work-screens";

// Guards the screenshots that replace the drawn compositions: every listed
// file must exist, be described in both languages, and come with an intro
// that replaces the "Compositions from ..." line.
const assets = (Object.entries(WORK_SCREENS) as [string, (typeof WORK_SCREENS)[keyof typeof WORK_SCREENS]][]).flatMap(([slug, w]) =>
  [...(w.cover ? [w.cover] : []), ...w.screens].map((asset) => [slug, asset] as [string, ScreenAsset]),
);

describe("work screenshots manifest", () => {
  test("covers exactly the four projects still shown with compositions", () => {
    expect(Object.keys(WORK_SCREENS).sort()).toEqual(["kwayes", "nazarih", "tanglevibe", "taskaty"]);
  });

  test("projects with real screens describe them (no leftover composition wording)", () => {
    for (const [slug, w] of Object.entries(WORK_SCREENS)) {
      if (w.screens.length === 0) continue;
      expect(w.intro?.en, slug).toBeTruthy();
      expect(w.intro?.ar, slug).toBeTruthy();
      expect(`${w.intro?.en} ${w.intro?.ar}`, slug).not.toMatch(/composition/i);
    }
  });

  test.runIf(assets.length > 0)("every screenshot exists under its project, with size and bilingual alt text", () => {
    for (const [slug, a] of assets) {
      expect(a.src, slug).toMatch(new RegExp(`^/work/${slug}/[\\w.-]+\\.(png|jpe?g|webp)$`));
      expect(existsSync(join(process.cwd(), "public", a.src)), a.src).toBe(true);
      expect(a.width > 0 && a.height > 0, a.src).toBe(true);
      expect(a.alt.en.trim().length, a.src).toBeGreaterThan(3);
      expect(a.alt.ar.trim().length, a.src).toBeGreaterThan(3);
      expect(`${a.alt.en} ${a.alt.ar}`, a.src).not.toMatch(/TEMP|TODO|placeholder/i);
    }
  });
});
