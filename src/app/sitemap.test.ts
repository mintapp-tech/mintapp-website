import { describe, expect, test } from "vitest";
import sitemap from "./sitemap";
import { SITE_URL } from "@/lib/seo";
import { SUPPORTED_LOCALES } from "@/lib/locales";

describe("sitemap", () => {
  const entries = sitemap();

  test("contains exactly 24 URLs", () => {
    expect(entries.length).toBe(24);
  });

  test("every URL is absolute, using the fixed production origin — never derived from a request host", () => {
    for (const entry of entries) {
      expect(entry.url.startsWith(`${SITE_URL}/`)).toBe(true);
    }
  });

  test("includes both an English and an Arabic URL for every real public path", () => {
    const paths = [
      "",
      "/about",
      "/services",
      "/start",
      "/privacy",
      "/work/arrentio",
      "/work/jameel",
      "/work/kwayes",
      "/work/nazarih",
      "/work/rentop",
      "/work/tanglevibe",
      "/work/taskaty",
    ];
    for (const path of paths) {
      expect(entries.some((e) => e.url === `${SITE_URL}/en${path}`)).toBe(true);
      expect(entries.some((e) => e.url === `${SITE_URL}/ar${path}`)).toBe(true);
    }
  });

  test("the root route is normalized to the bare locale URL, no trailing slash", () => {
    expect(entries.some((e) => e.url === `${SITE_URL}/en`)).toBe(true);
    expect(entries.some((e) => e.url === `${SITE_URL}/ar`)).toBe(true);
    expect(entries.some((e) => e.url === `${SITE_URL}/en/`)).toBe(false);
    expect(entries.some((e) => e.url === `${SITE_URL}/ar/`)).toBe(false);
  });

  test("no duplicate URLs", () => {
    const urls = entries.map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  test("never includes /work (no Work index route exists)", () => {
    expect(entries.some((e) => e.url === `${SITE_URL}/en/work` || e.url === `${SITE_URL}/ar/work`)).toBe(false);
  });

  test("never includes the removed Insights pages", () => {
    expect(entries.some((e) => e.url.includes("/insights"))).toBe(false);
  });

  test("never includes /internal/concept-pack", () => {
    expect(entries.some((e) => e.url.includes("/internal"))).toBe(false);
  });

  test("never includes a locale other than the two supported ones", () => {
    for (const entry of entries) {
      const afterOrigin = entry.url.slice(SITE_URL.length + 1);
      const firstSegment = afterOrigin.split("/")[0];
      expect((SUPPORTED_LOCALES as readonly string[]).includes(firstSegment)).toBe(true);
    }
  });

  test("no double slashes anywhere after the origin", () => {
    for (const entry of entries) {
      const afterProtocol = entry.url.replace("https://", "");
      expect(afterProtocol.includes("//")).toBe(false);
    }
  });

  test("never fabricates lastModified, changeFrequency, or priority", () => {
    for (const entry of entries) {
      expect(entry.lastModified).toBeUndefined();
      expect(entry.changeFrequency).toBeUndefined();
      expect(entry.priority).toBeUndefined();
    }
  });
});
