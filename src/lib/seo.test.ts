import { describe, expect, test } from "vitest";
import { buildPageMetadata, SITE_URL } from "./seo";

describe("buildPageMetadata", () => {
  test("builds a self-canonical URL scoped to the requested locale", () => {
    const meta = buildPageMetadata({ locale: "en", path: "/about", title: "t", description: "d" });
    expect(meta.alternates?.canonical).toBe("/en/about");
  });

  test("the Arabic locale self-canonicalizes to its own Arabic path, not the English one", () => {
    const meta = buildPageMetadata({ locale: "ar", path: "/about", title: "t", description: "d" });
    expect(meta.alternates?.canonical).toBe("/ar/about");
  });

  test("emits a reciprocal en/ar alternate pair regardless of which locale is being built", () => {
    const en = buildPageMetadata({ locale: "en", path: "/services", title: "t", description: "d" });
    const ar = buildPageMetadata({ locale: "ar", path: "/services", title: "t", description: "d" });
    expect(en.alternates?.languages).toEqual({ en: "/en/services", ar: "/ar/services" });
    expect(ar.alternates?.languages).toEqual({ en: "/en/services", ar: "/ar/services" });
  });

  test("the home route (empty path) still produces a well-formed locale-root canonical and alternates", () => {
    const meta = buildPageMetadata({ locale: "en", path: "", title: "t", description: "d" });
    expect(meta.alternates?.canonical).toBe("/en");
    expect(meta.alternates?.languages).toEqual({ en: "/en", ar: "/ar" });
  });

  test("never sets an x-default alternate", () => {
    const meta = buildPageMetadata({ locale: "en", path: "/about", title: "t", description: "d" });
    const languages = meta.alternates?.languages as Record<string, unknown> | undefined;
    expect(languages).not.toHaveProperty("x-default");
  });

  test("passes through the exact title and description given, per locale", () => {
    const meta = buildPageMetadata({ locale: "ar", path: "/start", title: "ابدأ مشروعك — Mintapp", description: "وصف عربي" });
    expect(meta.title).toBe("ابدأ مشروعك — Mintapp");
    expect(meta.description).toBe("وصف عربي");
  });

  test("SITE_URL is the real production origin, used only as metadataBase elsewhere", () => {
    expect(SITE_URL).toBe("https://www.mintapp.tech");
  });
});
