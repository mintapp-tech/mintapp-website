import { describe, expect, test } from "vitest";
import robots from "./robots";
import { SITE_URL } from "@/lib/seo";

describe("robots", () => {
  const result = robots();

  test("references the production sitemap with an absolute URL", () => {
    expect(result.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });

  test("disallows /internal/", () => {
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    expect(rules.some((r) => r.disallow === "/internal/")).toBe(true);
  });

  test("does not disallow the public site — /en/, /ar/, /services, /start and case-study routes stay crawlable", () => {
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const disallowed = rules.flatMap((r) => (Array.isArray(r.disallow) ? r.disallow : r.disallow ? [r.disallow] : []));
    for (const path of ["/en/", "/ar/", "/services", "/start", "/work/jameel"]) {
      expect(disallowed.some((d) => path.startsWith(d))).toBe(false);
    }
    expect(rules.some((r) => r.allow === "/")).toBe(true);
  });

  test("never references a preview-deployment URL", () => {
    expect(result.sitemap).not.toContain("vercel.app");
  });
});
