import { describe, expect, test } from "vitest";
import { figuresIn } from "@/lib/preparation/draft";
import { claudePrompt, draftText, structuredBrief, unstatedFigures } from "./brief";
import { preparationNotice } from "./status";

const inquiry = {
  preferred_language: "en",
  project_type: "web_app",
  project_description: "We run three clinics. Patients book by phone. Budget around 50,000 EGP.",
  budget_range: null,
  timeline: "Within 3 months",
  country: null,
};

describe("figures", () => {
  test("keep separators and decimals together, in Western and Arabic-Indic digits", () => {
    expect(figuresIn("Propose a $4,000 first phase, 2.5 weeks, 12 branches")).toEqual(["4000", "2.5", "12"]);
    expect(figuresIn("عندنا ١٢ فرعًا وميزانية ٤٬٠٠٠")).toEqual(["12", "4000"]);
  });

  test("unstated figures in a team draft ignore list numbering but catch invented amounts", () => {
    const brief = structuredBrief(inquiry).text;
    expect(unstatedFigures("1. Summary\n2) Facts\nBudget 50,000 EGP, launch in 3 months", brief)).toEqual([]);
    expect(unstatedFigures("1. Next step: quote $4,000 for 6 weeks", brief)).toEqual(["4000", "6"]);
  });
});

describe("structured brief", () => {
  test("separates what the client provided from what is missing, without contact details", () => {
    const b = structuredBrief({ ...inquiry, ...({ full_name: "Jane", email: "jane@example.com", phone: "+201" } as object) });
    expect(b.provided).toEqual([
      { label: "Project type", value: "web_app" },
      { label: "Timeline (client-stated)", value: "Within 3 months" },
    ]);
    expect(b.missing).toEqual(["Budget range", "Country"]);
    const prompt = claudePrompt(b);
    expect(prompt).toContain("three clinics");
    expect(prompt).toMatch(/do not invent prices/);
    expect(prompt).not.toMatch(/Jane|jane@|\+201/);
  });

  test("an Arabic inquiry asks for an Arabic note", () => {
    expect(claudePrompt(structuredBrief({ ...inquiry, preferred_language: "ar" }))).toContain("in Arabic");
  });

  test("structured drafts render as editable text; text drafts render as they are", () => {
    expect(draftText({ format: "text", body: "Hello" })).toBe("Hello");
    const text = draftText({
      language: "en",
      summary: "S",
      clientFacts: { problem: [{ text: "P", evidence: "E" }], audience: [], goals: [], existingMaterials: [], constraints: [] },
      assumptions: [],
      missingInformation: ["Budget"],
      meetingQuestions: [{ question: "Q1", purpose: "x" }, { question: "Q2", purpose: "x" }, { question: "Q3", purpose: "x" }],
      suggestedScope: { summary: "Scope", firstRelease: [] },
      nextStep: "Next",
    });
    expect(text).toContain('## Client facts\n- problem: P ("E")');
    expect(text).toContain("## Missing information\n- Budget");
  });
});

describe("preparation notices: nothing waits silently", () => {
  const base = { status: "queued", attempts: 0, max_attempts: 3, next_attempt_at: new Date().toISOString(), last_error: null, generator: null };
  const off = { enabled: false, paused: [] };
  const on = { enabled: true, provider: "codecraft", paused: [] };

  test.each([
    ["queued with automation off", base, off, "attention", "Waiting for manual preparation"],
    ["failed", { ...base, status: "failed", attempts: 3, last_error: "invalid_unsupported_number" }, on, "attention", "Automated preparation failed"],
    ["paused for budget", { ...base, status: "paused", last_error: "budget_exhausted" }, on, "attention", "Automation is paused"],
    ["queued while the provider is paused", { ...base, generator: "codecraft" }, { ...on, paused: [{ provider: "codecraft", paused_reason: "quota_exhausted" }] }, "attention", "Waiting: automation is paused"],
    ["queued with automation on", base, on, "info", "Queued for automated preparation"],
    ["prepared manually", { ...base, status: "manual" }, off, "ok", "Prepared manually"],
  ] as const)("%s", (_name, prep, automation, tone, title) => {
    const notice = preparationNotice(prep, automation);
    expect(notice.tone).toBe(tone);
    expect(notice.title).toBe(title);
  });

  test("failure reasons are explained in plain language", () => {
    expect(preparationNotice({ ...base, status: "failed", last_error: "invalid_unsupported_number" }, on).detail).toContain("figures the client never stated");
    expect(preparationNotice({ ...base, status: "paused", last_error: "quota_exhausted" }, on).detail).toContain("free allowance is used up");
  });
});
