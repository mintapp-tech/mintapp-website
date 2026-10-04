import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { TESTIMONIALS, publicationProblems, publishableTestimonials, testimonialForLocale } from "./testimonials";
import { TESTIMONIAL_FIXTURES, UNPUBLISHABLE_FIXTURES } from "./testimonial-fixtures";

describe("real testimonials", () => {
  test("every entry passes the publication check (nothing unapproved is ever listed)", () => {
    for (const t of TESTIMONIALS) expect(publicationProblems(t), t.id).toEqual([]);
  });

  test("contain no fixture or sample wording", () => {
    const text = JSON.stringify(TESTIMONIALS);
    expect(text).not.toMatch(/FIXTURE|Sample Client|Example (Co|Group|Studio)|عيّنة اختبار/);
  });

  test("ids are unique", () => {
    expect(new Set(TESTIMONIALS.map((t) => t.id)).size).toBe(TESTIMONIALS.length);
  });

  test("fixtures are only imported by the development preview page", () => {
    const importers: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") && readFileSync(path, "utf8").includes("testimonial-fixtures")) importers.push(path.replace(/\\/g, "/"));
      }
    };
    walk(join(process.cwd(), "src"));
    expect(importers).toEqual([expect.stringMatching(/src\/app\/\[locale\]\/preview\/testimonials\/page\.tsx$/)]);
  });
});

describe("publication check", () => {
  test("accepts fully approved entries, including role-and-company attribution without a name", () => {
    expect(publishableTestimonials(TESTIMONIAL_FIXTURES).map((t) => t.id)).toEqual(TESTIMONIAL_FIXTURES.map((t) => t.id));
  });

  test.each([
    ["fixture-quote-not-approved", "quote_not_approved"],
    ["fixture-name-not-approved", "name_not_approved"],
    ["fixture-no-record", "missing_approval_record"],
    ["fixture-photo-not-approved", "photo_not_approved"],
    ["fixture-no-attribution", "no_attribution"],
    ["fixture-translation-not-approved", "translation_not_approved"],
    ["fixture-empty", "empty_quote"],
  ])("rejects %s (%s)", (id, problem) => {
    const entry = UNPUBLISHABLE_FIXTURES.find((t) => t.id === id)!;
    expect(publicationProblems(entry)).toContain(problem);
    expect(publishableTestimonials([entry])).toEqual([]);
  });
});

describe("testimonialForLocale", () => {
  const [translated, arabicOnly] = TESTIMONIAL_FIXTURES;

  test("uses the approved translation on the other locale", () => {
    const ar = testimonialForLocale(translated, "ar");
    expect(ar.quote).toBe(translated.translation!.ar);
    expect(ar.quoteLanguage).toBe("ar");
    expect(ar.role).toBe("مؤسس");
  });

  test("keeps the original words, marked with their language, when no translation exists", () => {
    const en = testimonialForLocale(arabicOnly, "en");
    expect(en.quote).toBe(arabicOnly.quote);
    expect(en.quoteLanguage).toBe("ar");
  });
});
