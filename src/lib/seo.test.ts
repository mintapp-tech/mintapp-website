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

describe("buildPageMetadata — Open Graph", () => {
  test("uses the same localized title and description as the page itself, never a second copy", () => {
    const meta = buildPageMetadata({ locale: "en", path: "/services", title: "Services — Mintapp", description: "en desc" });
    const og = meta.openGraph as Record<string, unknown>;
    expect(og.title).toBe("Services — Mintapp");
    expect(og.description).toBe("en desc");

    const ar = buildPageMetadata({ locale: "ar", path: "/services", title: "خدماتنا — Mintapp", description: "ar desc" });
    const ogAr = ar.openGraph as Record<string, unknown>;
    expect(ogAr.title).toBe("خدماتنا — Mintapp");
    expect(ogAr.description).toBe("ar desc");
  });

  test("type is always website, including for case-study pages — never classified as an article", () => {
    const meta = buildPageMetadata({ locale: "en", path: "/work/jameel", title: "t", description: "d" });
    const og = meta.openGraph as Record<string, unknown>;
    expect(og.type).toBe("website");
  });

  test("url is the page-specific self-canonical path (resolves to an absolute production URL via metadataBase)", () => {
    const home = buildPageMetadata({ locale: "en", path: "", title: "t", description: "d" });
    expect((home.openGraph as Record<string, unknown>).url).toBe("/en");

    const jameel = buildPageMetadata({ locale: "ar", path: "/work/jameel", title: "t", description: "d" });
    expect((jameel.openGraph as Record<string, unknown>).url).toBe("/ar/work/jameel");
  });

  test("siteName is always exactly Mintapp", () => {
    for (const locale of ["en", "ar"] as const) {
      const meta = buildPageMetadata({ locale, path: "/about", title: "t", description: "d" });
      expect((meta.openGraph as Record<string, unknown>).siteName).toBe("Mintapp");
    }
  });

  test("locale is en_US for English pages and ar_EG for Arabic pages", () => {
    const en = buildPageMetadata({ locale: "en", path: "/about", title: "t", description: "d" });
    expect((en.openGraph as Record<string, unknown>).locale).toBe("en_US");

    const ar = buildPageMetadata({ locale: "ar", path: "/about", title: "t", description: "d" });
    expect((ar.openGraph as Record<string, unknown>).locale).toBe("ar_EG");
  });

  test("alternateLocale is the reciprocal locale, never the same as locale itself", () => {
    const en = buildPageMetadata({ locale: "en", path: "/about", title: "t", description: "d" });
    expect((en.openGraph as Record<string, unknown>).alternateLocale).toBe("ar_EG");

    const ar = buildPageMetadata({ locale: "ar", path: "/about", title: "t", description: "d" });
    expect((ar.openGraph as Record<string, unknown>).alternateLocale).toBe("en_US");
  });

  test("image is the absolute production default social image, with correct width, height, and alt text", () => {
    const meta = buildPageMetadata({ locale: "en", path: "/about", title: "t", description: "d" });
    const og = meta.openGraph as Record<string, unknown>;
    const images = og.images as { url: string; width: number; height: number; alt: string }[];
    expect(images).toHaveLength(1);
    expect(images[0].url).toBe(`${SITE_URL}/og/mintapp-default.png`);
    expect(images[0].width).toBe(1200);
    expect(images[0].height).toBe(630);
    expect(images[0].alt.length).toBeGreaterThan(0);
  });

  test("the default image is identical across every page — one sitewide image, no drift", () => {
    const a = buildPageMetadata({ locale: "en", path: "/about", title: "t", description: "d" });
    const b = buildPageMetadata({ locale: "ar", path: "/work/taskaty", title: "t", description: "d" });
    const imgA = (a.openGraph as Record<string, unknown>).images as { url: string }[];
    const imgB = (b.openGraph as Record<string, unknown>).images as { url: string }[];
    expect(imgA[0].url).toBe(imgB[0].url);
  });
});

describe("buildPageMetadata — Twitter", () => {
  test("card is always summary_large_image", () => {
    const meta = buildPageMetadata({ locale: "en", path: "/about", title: "t", description: "d" });
    expect((meta.twitter as Record<string, unknown>).card).toBe("summary_large_image");
  });

  test("uses the same localized title and description as Open Graph and the page itself", () => {
    const meta = buildPageMetadata({ locale: "ar", path: "/start", title: "ابدأ مشروعك — Mintapp", description: "ar desc" });
    const twitter = meta.twitter as Record<string, unknown>;
    expect(twitter.title).toBe("ابدأ مشروعك — Mintapp");
    expect(twitter.description).toBe("ar desc");
  });

  test("image is the absolute production default social image with alt text", () => {
    const meta = buildPageMetadata({ locale: "en", path: "/about", title: "t", description: "d" });
    const twitter = meta.twitter as Record<string, unknown>;
    const images = twitter.images as { url: string; alt: string; width: number; height: number }[];
    expect(images[0].url).toBe(`${SITE_URL}/og/mintapp-default.png`);
    expect(images[0].alt.length).toBeGreaterThan(0);
    expect(images[0].width).toBe(1200);
    expect(images[0].height).toBe(630);
  });

  test("never includes a site or creator handle — none is verified to exist", () => {
    const meta = buildPageMetadata({ locale: "en", path: "/about", title: "t", description: "d" });
    const twitter = meta.twitter as Record<string, unknown>;
    expect(twitter.site).toBeUndefined();
    expect(twitter.creator).toBeUndefined();
  });
});

describe("buildPageMetadata — unsupported locale/path input is not silently normalized", () => {
  test("an arbitrary path string is passed through as given (the caller, not this helper, is responsible for path validity)", () => {
    const meta = buildPageMetadata({ locale: "en", path: "/not-a-real-route", title: "t", description: "d" });
    expect(meta.alternates?.canonical).toBe("/en/not-a-real-route");
    expect((meta.openGraph as Record<string, unknown>).url).toBe("/en/not-a-real-route");
  });
});
