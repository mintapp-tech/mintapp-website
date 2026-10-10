import { describe, expect, test } from "vitest";
import { inquirySchema } from "./inquiry-schema";

const validBase = {
  name: "Jane Doe",
  email: "jane@example.com",
  desc: "A".repeat(50),
  lang: "en" as const,
  consent: true as const,
  submissionToken: "e8e7d808-9556-45b8-beae-49f852e98be9",
  formStartedAt: new Date().toISOString(),
  turnstileToken: "x".repeat(30),
};

describe("inquirySchema — turnstileToken bounds", () => {
  test("valid submission with a normal-length token passes", () => {
    expect(inquirySchema.safeParse(validBase).success).toBe(true);
  });

  test("empty turnstileToken is rejected", () => {
    expect(inquirySchema.safeParse({ ...validBase, turnstileToken: "" }).success).toBe(false);
  });

  test("missing turnstileToken is rejected", () => {
    const rest: Record<string, unknown> = { ...validBase };
    delete rest.turnstileToken;
    expect(inquirySchema.safeParse(rest).success).toBe(false);
  });

  test("turnstileToken at exactly 2048 chars is accepted (documented Cloudflare max)", () => {
    expect(inquirySchema.safeParse({ ...validBase, turnstileToken: "x".repeat(2048) }).success).toBe(true);
  });

  test("turnstileToken over 2048 chars is rejected (bounded, not unlimited)", () => {
    expect(inquirySchema.safeParse({ ...validBase, turnstileToken: "x".repeat(2049) }).success).toBe(false);
  });

  test("garbage (non-empty, in-bounds) turnstileToken passes schema — Cloudflare, not Zod, is the authority on validity", () => {
    expect(inquirySchema.safeParse({ ...validBase, turnstileToken: "not-a-real-token-just-garbage" }).success).toBe(true);
  });
});

describe("inquirySchema — honeypot is shape-only, never a schema rejection", () => {
  test("empty honeypot (legitimate user) passes and defaults to empty string", () => {
    const result = inquirySchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.honeypot).toBe("");
  });

  test("filled honeypot (bot signal) still passes schema shape validation — rejection is business logic, not a schema failure", () => {
    const result = inquirySchema.safeParse({ ...validBase, honeypot: "bot filled this in" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.honeypot).toBe("bot filled this in");
  });
});

describe("inquirySchema — project type", () => {
  test.each(["website", "web_app", "mobile_app", "not_sure"])("accepts %s", (projectType) => {
    const result = inquirySchema.safeParse({ ...validBase, projectType });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.projectType).toBe(projectType);
  });

  test("an older cached form that sends no project type is still accepted, with nothing guessed", () => {
    const result = inquirySchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.projectType).toBeUndefined();
  });

  // The legacy database values (website_and_mobile, other) are not offered by the form.
  test.each(["other", "website_and_mobile", "Website", "WEB_APP", "web app", "", "mobile", null, 3, ["website"]])("rejects %j", (projectType) => {
    const result = inquirySchema.safeParse({ ...validBase, projectType });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(["projectType"]);
  });
});

describe("inquirySchema — budget, timeline and existing link", () => {
  test("an older cached form without the three new fields is still accepted", () => {
    const parsed = inquirySchema.parse(validBase);
    expect(parsed.budget).toBeUndefined();
    expect(parsed.timeline).toBeUndefined();
    expect(parsed.existingUrl).toBeUndefined();
  });

  test("a budget range is stored with the currency it was chosen in, from either scale", () => {
    expect(inquirySchema.parse({ ...validBase, budget: "5000_10000", budgetCurrency: "USD", timeline: "within_3_months" })).toMatchObject({ budget: "5000_10000", budgetCurrency: "USD", timeline: "within_3_months" });
    expect(inquirySchema.parse({ ...validBase, budget: "100000_250000", budgetCurrency: "EGP" })).toMatchObject({ budget: "100000_250000", budgetCurrency: "EGP" });
    expect(inquirySchema.parse({ ...validBase, budget: "not_sure", budgetCurrency: "EGP", timeline: "not_sure" })).toMatchObject({ budget: "not_sure", budgetCurrency: "EGP", timeline: "not_sure" });
  });

  test.each([
    ["an Egyptian range in dollars", { budget: "under_50000", budgetCurrency: "USD" }, "invalid_value"],
    ["a dollar range in pounds", { budget: "5000_10000", budgetCurrency: "EGP" }, "invalid_value"],
    ["an older dollar label in pounds", { budget: "Under USD 5,000", budgetCurrency: "EGP" }, "invalid_value"],
    ["an Egyptian range with no currency", { budget: "under_50000" }, "invalid_value"],
    ["a currency with no range", { budgetCurrency: "EGP" }, "required"],
  ])("refuses %s on the budget field", (_name, fields, message) => {
    const r = inquirySchema.safeParse({ ...validBase, ...fields });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]).toMatchObject({ path: ["budget"], message });
  });

  test("an older cached form (no currency) still submits: its budget is US dollars; exact meanings become codes", () => {
    expect(inquirySchema.parse({ ...validBase, budget: "5000_10000" })).toMatchObject({ budget: "5000_10000", budgetCurrency: "USD" });
    expect(inquirySchema.parse({ ...validBase, budget: "Not sure yet", timeline: "Within 3 months" })).toMatchObject({ budget: "not_sure", budgetCurrency: "USD", timeline: "within_3_months" });
    expect(inquirySchema.parse({ ...validBase, timeline: "Later than 6 months" }).timeline).toBe("over_6_months");
    expect(inquirySchema.parse({ ...validBase, budget: "USD 5,000 - 15,000" })).toMatchObject({ budget: "USD 5,000 - 15,000", budgetCurrency: "USD" });
  });

  test.each([["budget", "a million"], ["budget", "5,000"], ["budget", "NOT_SURE"], ["timeline", "yesterday"], ["timeline", "toString"], ["budget", 5000], ["budgetCurrency", "EUR"], ["budgetCurrency", "egp"]])("rejects %s %j", (key, value) => {
    const r = inquirySchema.safeParse({ ...validBase, budget: "not_sure", [key]: value });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual([key]);
  });

  test("the existing link is stored normalized; unsafe links are refused", () => {
    expect(inquirySchema.parse({ ...validBase, existingUrl: "acme.example.com/app#top" }).existingUrl).toBe("https://acme.example.com/app");
    expect(inquirySchema.parse({ ...validBase, existingUrl: "  " }).existingUrl).toBeUndefined();
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "ftp://acme.example.com", "https://user:pass@acme.example.com", "http://localhost:3000", "http://192.168.0.1", "not a url", "x".repeat(301)]) {
      const r = inquirySchema.safeParse({ ...validBase, existingUrl: bad });
      expect(r.success, bad).toBe(false);
      if (!r.success) expect(r.error.issues[0].path[0]).toBe("existingUrl");
    }
  });
});
