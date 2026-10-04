import { test, expect } from "@playwright/test";

// Arabic pages describe their screenshots in Arabic; decorative images keep an
// empty alt.
for (const path of ["/ar", "/ar/work/arrentio", "/ar/work/rentop", "/ar/work/jameel"]) {
  test(`${path}: image alt text is Arabic or intentionally empty`, async ({ page }) => {
    await page.goto(path);
    const alts = await page.locator("main img").evaluateAll((imgs) => imgs.map((i) => i.getAttribute("alt")));
    expect(alts.length).toBeGreaterThan(0);
    for (const alt of alts) {
      expect(alt).not.toBeNull();
      if (alt) expect(alt, alt).toMatch(/[؀-ۿ]/);
    }
  });
}
