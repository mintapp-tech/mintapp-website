import { describe, expect, test } from "vitest";
import { CLIENT_PROJECT_TYPES, PROJECT_TYPE_WORDS, clientProjectType } from "./project-type";
import { structuredBrief } from "./brief";
import { labelsFor } from "./status";
import { buildGenerationInput, type InquiryForPreparation } from "@/lib/preparation/input";

// The project type is shown as "provided by the client" only when the client
// chose it on the form. Older values, and a missing value, are "not provided".

const base: InquiryForPreparation = {
  preferred_language: "en",
  project_type: null,
  project_description: "We run three clinics and want online booking.",
  budget_range: null,
  timeline: null,
  country: null,
};
const withType = (project_type: string | null, extra: Partial<InquiryForPreparation> = {}) => ({ ...base, ...extra, project_type });

describe("clientProjectType", () => {
  test("accepts exactly the four choices on the public form", () => {
    expect([...CLIENT_PROJECT_TYPES]).toEqual(["website", "web_app", "mobile_app", "not_sure"]);
    for (const value of CLIENT_PROJECT_TYPES) expect(clientProjectType(value)).toBe(value);
  });

  test("everything else is not the client's answer", () => {
    for (const value of [null, undefined, "", "other", "website_and_mobile", "Website", "web app", "unknown"]) expect(clientProjectType(value), String(value)).toBeNull();
  });
});

describe("wording matches the public form, in both languages", () => {
  test("English", () => {
    expect(PROJECT_TYPE_WORDS.en).toEqual({ website: "Website", web_app: "Web application", mobile_app: "Mobile application", not_sure: "Not sure yet" });
    expect(labelsFor("en").projectType).toEqual(PROJECT_TYPE_WORDS.en);
  });

  test("Arabic", () => {
    expect(PROJECT_TYPE_WORDS.ar).toEqual({ website: "موقع إلكتروني", web_app: "تطبيق ويب", mobile_app: "تطبيق جوّال", not_sure: "لست متأكدًا بعد" });
    expect(labelsFor("ar").projectType).toEqual(PROJECT_TYPE_WORDS.ar);
  });

  test("an old value is not offered a label that would show it as a client answer", () => {
    for (const locale of ["en", "ar"] as const) {
      expect(labelsFor(locale).projectType).not.toHaveProperty("other");
      expect(labelsFor(locale).projectType).not.toHaveProperty("website_and_mobile");
    }
  });
});

describe("structured brief", () => {
  test.each(CLIENT_PROJECT_TYPES)("an explicit %s choice is listed under what the client provided", (value) => {
    const brief = structuredBrief(withType(value));
    expect(brief.provided).toEqual([{ label: "Project type", value }]);
    expect(brief.missing).not.toContain("Project type");
  });

  test.each([null, "other", "website_and_mobile"])("%s is not provided: it is listed as missing, never as provided", (value) => {
    const brief = structuredBrief(withType(value));
    expect(brief.provided.map((p) => p.label)).not.toContain("Project type");
    expect(brief.missing).toContain("Project type");
  });

  test("nothing is inferred from the written brief", () => {
    const brief = structuredBrief(withType(null, { project_description: "We need a mobile app and a website." }));
    expect(brief.provided).toEqual([]);
    expect(brief.text).not.toMatch(/Project type/);
  });
});

describe("text sent to a generator", () => {
  test("names the client's choice in words, in the brief's language", () => {
    expect(buildGenerationInput(withType("web_app")).brief).toContain("Project type: Web application");
    expect(buildGenerationInput(withType("not_sure")).brief).toContain("Project type: Not sure yet");
    expect(buildGenerationInput(withType("mobile_app", { preferred_language: "ar" })).brief).toContain("نوع المشروع: تطبيق جوّال");
  });

  test("leaves the line out for a missing or older value, so nothing is presented as the client's choice", () => {
    for (const value of [null, "other", "website_and_mobile"]) expect(buildGenerationInput(withType(value)).brief, String(value)).not.toMatch(/Project type|Other/);
  });
});
