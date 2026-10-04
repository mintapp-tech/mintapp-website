import { describe, expect, test } from "vitest";
import { figuresIn } from "@/lib/preparation/draft";
import { claudePrompt, draftText, structuredBrief, unstatedFigures } from "./brief";
import { preparationNotice } from "./status";
import { createSessionToken, verifySessionToken, SESSION_TTL_SECONDS } from "@/lib/team-auth/session";
import { teamAccounts } from "@/lib/team-auth/accounts";
import { hashPassword, verifyPassword } from "../../../scripts/lib/team-password.mjs";

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

describe("team accounts and sessions", () => {
  const secret = "x".repeat(40);
  const env = (hash: string) => ({
    TEAM_ACCOUNTS: JSON.stringify([{ email: "Omar@Mintapp.Tech", name: "Omar", passwordHash: hash }]),
    DASHBOARD_SESSION_SECRET: secret,
  });

  test("passwords are hashed with scrypt; short passwords are refused", async () => {
    const hash = await hashPassword("a-long-enough-test-password");
    expect(hash).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(await verifyPassword("a-long-enough-test-password", hash)).toBe(true);
    expect(await verifyPassword("wrong-password-attempt!!", hash)).toBe(false);
    await expect(hashPassword("short")).rejects.toThrow(/at least 16/);
  });

  test("accounts are normalized; invalid or duplicate configuration means no access", async () => {
    const hash = await hashPassword("a-long-enough-test-password");
    expect(teamAccounts(env(hash))).toEqual([{ email: "omar@mintapp.tech", name: "Omar", passwordHash: hash }]);
    expect(teamAccounts({ TEAM_ACCOUNTS: "not json" })).toEqual([]);
    expect(teamAccounts({ TEAM_ACCOUNTS: JSON.stringify([{ email: "a@b.co", name: "A", passwordHash: "plain-text" }]) })).toEqual([]);
    expect(teamAccounts({ TEAM_ACCOUNTS: JSON.stringify([{ email: "a@b.co", name: "A", passwordHash: hash }, { email: "A@b.co", name: "B", passwordHash: hash }]) })).toEqual([]);
  });

  test("sessions verify only when signed, unexpired and for a current account", async () => {
    const e = env(await hashPassword("a-long-enough-test-password"));
    const now = Date.now();
    const token = createSessionToken({ email: "omar@mintapp.tech" }, now, e)!;
    expect(verifySessionToken(token, now, e)).toEqual({ email: "omar@mintapp.tech", name: "Omar" });
    // Tampered payload or signature.
    const [data, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ v: 1, e: "omar@mintapp.tech", iat: 0, exp: 9e9 })).toString("base64url");
    expect(verifySessionToken(`${forged}.${sig}`, now, e)).toBeNull();
    expect(verifySessionToken(`${data}.${sig.slice(0, -2)}xx`, now, e)).toBeNull();
    // Expired, rotated secret, removed account, missing configuration.
    expect(verifySessionToken(token, now + (SESSION_TTL_SECONDS + 1) * 1000, e)).toBeNull();
    expect(verifySessionToken(token, now, { ...e, DASHBOARD_SESSION_SECRET: "y".repeat(40) })).toBeNull();
    expect(verifySessionToken(token, now, { ...e, TEAM_ACCOUNTS: "[]" })).toBeNull();
    expect(createSessionToken({ email: "omar@mintapp.tech" }, now, { ...e, DASHBOARD_SESSION_SECRET: "short" })).toBeNull();
  });
});
