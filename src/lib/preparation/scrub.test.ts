import { describe, expect, test } from "vitest";
import { buildGenerationInput } from "./input";
import { REMOVED, knownDetails, scrubContactDetails } from "./scrub";

const scrub = (text: string, known: string[] = []) => scrubContactDetails(text, known);

describe("contact details are cut out of a brief", () => {
  test("email addresses, links, bare domains and handles", () => {
    expect(scrub("Write to jane.doe+work@acme-health.co.uk about it")).toBe(`Write to ${REMOVED} about it`);
    expect(scrub("See https://www.acme.test/about?x=1 and http://localhost:3000/a")).toBe(`See ${REMOVED} and ${REMOVED}`);
    expect(scrub("Our site is www.acme.test, or acme.io/pricing, or acme.com.")).toBe(`Our site is ${REMOVED}, or ${REMOVED}, or ${REMOVED}.`);
    expect(scrub("DM me @jane_doe or follow @acme.health on LinkedIn")).toBe(`DM me ${REMOVED} or follow ${REMOVED} on LinkedIn`);
    expect(scrub("بريدي sara@clinic.eg وموقعي clinic.eg")).toBe(`بريدي ${REMOVED} وموقعي ${REMOVED}`);
  });

  test("phone numbers in the ways people write them, including Arabic digits", () => {
    for (const phone of ["+20 100 123 4567", "01001234567", "(0100) 123-4567", "+971 4 123 4567", "٠١٠٠١٢٣٤٥٦٧", "0020 100 1234567", "+44 20 7946 0958"]) {
      expect(scrub(`Call ${phone} today`), phone).toBe(`Call ${REMOVED} today`);
    }
  });

  test("figures that belong to the brief survive: counts, prices, durations, dates, ranges", () => {
    for (const keep of [
      "We run 3 clinics with about 200 patients a week",
      "Budget around $5,000 to $8,000 over 10-12 weeks",
      "Launch by 2026-10-09 or 09/10/2026",
      "Our app has 1 000 000 users and 35 staff",
      "الميزانية ٥٠٠٠ دولار خلال ١٢ أسبوعًا",
      "Version 2.5 of the plan, section 3.1.4, e.g. this, i.e. that",
    ]) {
      expect(scrub(keep), keep).toBe(keep);
    }
  });

  test("the inquiry's own name, company, email, phone and website are removed wherever repeated, in any case", () => {
    const known = knownDetails({ client_name: "Layla Hassan", company_name: "Cedar Labs", email: "layla@cedar-labs.test", phone: "+20 100 555 0101", company_url: "https://www.cedar-labs.test/en" });
    const text = "Hi, I'm LAYLA HASSAN from cedar labs. Reach me on 01005550101 or 20 100 555 0101 via cedar-labs.test, and we need booking for 3 clinics.";
    const out = scrub(text, known);
    for (const secret of ["LAYLA", "Hassan", "cedar", "01005550101", "555 0101", "cedar-labs"]) expect(out.toLowerCase(), secret).not.toContain(secret.toLowerCase());
    expect(out).toContain("we need booking for 3 clinics");
  });

  test("very short known values are ignored, so ordinary words are not eaten", () => {
    expect(scrub("We want a web app", ["we", "ab", null as unknown as string, " "])).toBe("We want a web app");
  });

  test("the generation input carries the scrubbed brief and nothing of the contact", () => {
    const input = buildGenerationInput({
      preferred_language: "en",
      project_type: "web_app",
      project_description: "I am Layla Hassan (layla@cedar-labs.test, +20 100 555 0101). We run 3 clinics and want online booking. See www.cedar-labs.test.",
      budget_range: null,
      timeline: null,
      country: "Egypt",
      redact: knownDetails({ client_name: "Layla Hassan", email: "layla@cedar-labs.test", phone: "+20 100 555 0101" }),
    });
    expect(input.brief).not.toMatch(/Layla|Hassan|cedar|@|555|www\./i);
    expect(input.brief).toContain("We run 3 clinics and want online booking.");
    expect(input.brief).toContain("Egypt");
  });

  test("with nothing to redact the brief is unchanged", () => {
    const input = buildGenerationInput({ preferred_language: "en", project_type: null, project_description: "A booking app for my studio.", budget_range: null, timeline: null, country: null });
    expect(input.brief).toBe("Project description:\nA booking app for my studio.");
  });
});

describe("what the worker hands to a generator", () => {
  test("is the scrubbed brief only: no name, email, phone, company or website reaches it", async () => {
    const { runPreparationBatch } = await import("./worker");
    const seen: string[] = [];
    const inquiry = {
      preferred_language: "en",
      project_type: "web_app",
      project_description: "Layla Hassan of Cedar Labs here (layla@cedar-labs.test, 01005550101, www.cedar-labs.test). We run 3 clinics and want online booking.",
      budget_range: null,
      timeline: null,
      country: "Egypt",
      redact: knownDetails({ client_name: "Layla Hassan", company_name: "Cedar Labs", email: "layla@cedar-labs.test", phone: "01005550101", company_url: "https://www.cedar-labs.test" }),
    };
    await runPreparationBatch({
      store: {
        claim: async () => [{ inquiryId: "inq-1", attempts: 1 }],
        claimInquiry: async () => [],
        loadInquiry: async () => inquiry,
        complete: async () => 1,
        completePack: async () => 3,
        recordPayload: async () => {},
        fail: async () => "failed",
        pause: async () => {},
        monthlyTokens: async () => 0,
        recordUsage: async () => {},
      },
      generator: {
        id: "mock",
        model: "m",
        estimateTokens: () => 0,
        generate: async (input) => {
          seen.push(input.brief);
          return { ok: false, failure: "provider_error", retryable: false, pauseAutomation: false };
        },
      },
      monthlyTokenBudget: 0,
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]).not.toMatch(/Layla|Hassan|Cedar|cedar|@|0100|www\./);
    expect(seen[0]).toContain("We run 3 clinics and want online booking.");
  });
});
