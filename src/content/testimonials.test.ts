import { describe, expect, test } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { TESTIMONIALS, publicationProblems, publishableTestimonials, testimonialForLocale, type Testimonial } from "./testimonials";

// The approved wording, exactly as supplied (5 October 2026).
const OTJ_QUOTE =
  "Working with MintApp team on OTJ has been a great experience. They helped turn a complex idea into a working platform, from creative profiles and client briefs to proposals, payments, and project tracking. What I appreciate most is their willingness to keep improving the product with us as we learn from real users. Building a startup means things evolve constantly, and they’ve been part of that journey.";
const AL_WAKRAH_QUOTE =
  "What stood out about working with Mintapp was how well the team understood what we needed. They took our requirements seriously, handled the work professionally, and delivered a result we were happy with on the agreed timeline.";

describe("published testimonials", () => {
  test("exactly the two approved quotes, word for word, in order", () => {
    expect(publishableTestimonials().map((t) => [t.id, t.quote, t.quoteLanguage])).toEqual([
      ["otj-nour-makram", OTJ_QUOTE, "en"],
      ["al-wakrah-academy-supervisor", AL_WAKRAH_QUOTE, "en"],
    ]);
  });

  test("every entry passes the publication check", () => {
    for (const t of TESTIMONIALS) expect(publicationProblems(t), t.id).toEqual([]);
  });

  test("OTJ: Nour Makram, Founder, with OTJ's own logo; Al Wakrah: no personal name", () => {
    const [otj, wakrah] = TESTIMONIALS;
    expect(testimonialForLocale(otj, "en")).toMatchObject({ name: "Nour Makram", role: "Founder", company: "OTJ", logo: { src: "/testimonials/otj-logo.png" } });
    expect(otj.approval.logo).toBe(true);
    expect(existsSync(join(process.cwd(), "public", "testimonials", "otj-logo.png"))).toBe(true);
    expect(testimonialForLocale(wakrah, "en")).toMatchObject({ name: undefined, role: "Academy Supervisor", company: "Al Wakrah", logo: undefined });
    expect(wakrah.author.name).toBeUndefined();
  });

  test("Arabic pages keep the approved English words, marked as English; no translation is presented as a quote", () => {
    for (const t of TESTIMONIALS) {
      expect(t.translation).toBeUndefined();
      const ar = testimonialForLocale(t, "ar");
      expect(ar.quote).toBe(t.quote);
      expect(ar.quoteLanguage).toBe("en");
    }
    // Nour's Arabic title is feminine; Al Wakrah's attribution stays as approved.
    expect(testimonialForLocale(TESTIMONIALS[0], "ar")).toMatchObject({ role: "المؤسِّسة", company: "OTJ" });
    expect(testimonialForLocale(TESTIMONIALS[1], "ar")).toMatchObject({ role: "Academy Supervisor", company: "Al Wakrah" });
  });

  test("no fictional or sample testimonial exists anywhere in the application source", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && /testimonial-fixtures|review-samples|FIXTURE|Sample Client|sampleNotice/.test(readFileSync(path, "utf8"))) offenders.push(path);
      }
    };
    walk(join(process.cwd(), "src"));
    expect(offenders).toEqual([]);
  });
});

// Test-only entries for the publication rules. They live in this test file,
// which is never part of any build.
const approved: Testimonial["approval"] = { approvedBy: "Test", approvedOn: "2026-01-01", quote: true, name: true, company: true, photo: true, logo: true, translation: true };
const entry = (over: Omit<Partial<Testimonial>, "approval"> & { approval?: Partial<Testimonial["approval"]> }): Testimonial => ({
  id: "t",
  quote: "Words",
  quoteLanguage: "en",
  author: { name: "Person" },
  ...over,
  approval: { ...approved, ...over.approval },
});

describe("publication check", () => {
  test("accepts a role-and-company attribution without a name", () => {
    expect(publicationProblems(entry({ author: { role: { en: "Supervisor" }, company: { en: "Company" } } }))).toEqual([]);
  });

  test.each([
    ["quote not approved", entry({ approval: { quote: false } }), "quote_not_approved"],
    ["name not approved", entry({ approval: { name: false } }), "name_not_approved"],
    ["no approval record", entry({ approval: { approvedBy: "", approvedOn: "" } }), "missing_approval_record"],
    ["photo not approved", entry({ author: { name: "P", photo: "/p.png" }, approval: { photo: false } }), "photo_not_approved"],
    ["logo not approved", entry({ author: { name: "P", logo: { src: "/l.png", width: 1, height: 1 } }, approval: { logo: false } }), "logo_not_approved"],
    ["no attribution", entry({ author: {} }), "no_attribution"],
    ["translation not approved", entry({ translation: { ar: "كلمات" }, approval: { translation: false } }), "translation_not_approved"],
    ["empty quote", entry({ quote: "  " }), "empty_quote"],
  ] as const)("rejects: %s", (_name, t, problem) => {
    expect(publicationProblems(t)).toContain(problem);
    expect(publishableTestimonials([t])).toEqual([]);
  });

  test("an approved translation is used on the other locale", () => {
    const t = entry({ translation: { ar: "كلمات مترجمة" } });
    expect(testimonialForLocale(t, "ar")).toMatchObject({ quote: "كلمات مترجمة", quoteLanguage: "ar" });
  });
});
