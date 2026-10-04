import { expect, test } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { WORK_ALT_AR, localAlt } from "./work-alt";

test("every work screenshot alt text has an Arabic description", () => {
  const files = ["src/components/WorkSection.tsx", ...readdirSync("src/components/case-study").map((f) => join("src/components/case-study", f))];
  const used = files.flatMap((f) => [...readFileSync(f, "utf8").matchAll(/localAlt\("([^"]+)"/g)].map((m) => m[1]));
  expect(used.length).toBeGreaterThan(0);
  for (const en of used) expect(WORK_ALT_AR[en], en).toMatch(/[؀-ۿ]/);
  // No raw English alt left on these components.
  for (const f of files) expect(readFileSync(f, "utf8"), f).not.toMatch(/\salt="[A-Za-z]/);
});

test("localAlt returns English unchanged and Arabic for ar", () => {
  expect(localAlt("Rentop home screen", "en")).toBe("Rentop home screen");
  expect(localAlt("Rentop home screen", "ar")).toBe("الشاشة الرئيسية لتطبيق Rentop");
});
