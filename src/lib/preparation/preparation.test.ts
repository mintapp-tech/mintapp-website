import { describe, expect, test, vi } from "vitest";
import { buildGenerationInput } from "./input";
import { draftProblems, normalizeForMatch, validateDraft, type PreparationDraft } from "./draft";
import { createMockGenerator } from "./mock-generator";
import { createCodeCraftGenerator } from "./codecraft-generator";
import { selectGenerator } from "./config";
import { runPreparationBatch, type PreparationStore } from "./worker";
import { SYNTHETIC_BRIEFS } from "./synthetic-briefs";
import type { PreparationGenerator } from "./generator";
import { validatePack } from "@/lib/pack/schema";
import { clinicPack } from "@/lib/pack/test-fixtures";

const clinic = SYNTHETIC_BRIEFS[0];

describe("generation input", () => {
  test("contains the brief and the client's structured answers, never contact or tracking data", () => {
    const input = buildGenerationInput({
      ...clinic.inquiry,
      // Fields that exist on the inquiry row but must never be sent.
      ...({ full_name: "Jane Doe", email: "jane@example.com", phone: "+20100000", company_name: "Acme", company_url: "acme.test", utm_source: "x" } as object),
    });
    expect(input.language).toBe("en");
    expect(input.brief).toContain("three physiotherapy clinics");
    expect(input.brief).toContain("Budget range (client-stated): Not sure yet");
    expect(input.brief).not.toMatch(/Jane|jane@|\+20100000|Acme|acme\.test/);
  });

  test("Arabic inquiries are prepared in Arabic", () => {
    expect(buildGenerationInput(SYNTHETIC_BRIEFS[4].inquiry).brief).toMatch(/^نوع المشروع: /);
  });
});

const baseDraft = (over: Partial<PreparationDraft> = {}): PreparationDraft => ({
  language: "en",
  summary: "Three clinics want online booking.",
  clientFacts: {
    problem: [{ text: "Bookings happen by phone.", evidence: "Patients book by phone" }],
    audience: [],
    goals: [],
    existingMaterials: [{ text: "Schedules are in Google Sheets.", evidence: "We already use Google Sheets for schedules." }],
    constraints: [],
  },
  assumptions: [{ text: "Receptionists will manage the schedule.", reason: "They see the day's schedule today." }],
  missingInformation: ["Budget"],
  meetingQuestions: [
    { question: "Who books most often?", purpose: "Audience" },
    { question: "How are cancellations handled now?", purpose: "Current process" },
    { question: "Should therapists log in?", purpose: "Roles" },
  ],
  suggestedScope: { summary: "Booking for patients and a schedule view for receptionists.", firstRelease: ["Patient booking"] },
  nextStep: "Confirm roles in the meeting.",
  ...over,
});

describe("draft validation", () => {
  const brief = buildGenerationInput(clinic.inquiry).brief;

  test("accepts a draft whose facts quote the brief and whose figures the client stated", () => {
    expect(draftProblems(baseDraft(), brief, "en")).toEqual([]);
    expect(draftProblems(baseDraft({ summary: "Three clinics, launch within 3 months." }), brief, "en")).toEqual([]);
  });

  test("rejects a fact that does not quote the brief", () => {
    const draft = baseDraft();
    draft.clientFacts.goals = [{ text: "They want an AI assistant.", evidence: "We want an AI assistant" }];
    expect(draftProblems(draft, brief, "en")).toContainEqual({ kind: "ungrounded_fact", section: "goals", index: 0 });
  });

  test.each([
    ["an invented price", { nextStep: "Propose a $4,000 first phase." }],
    ["an invented deadline", { suggestedScope: { summary: "Deliver in 6 weeks.", firstRelease: [] } }],
    ["an invented metric", { assumptions: [{ text: "Cancellations drop 30%.", reason: "Typical result." }] }],
  ])("rejects %s", (_name, over) => {
    expect(draftProblems(baseDraft(over as Partial<PreparationDraft>), brief, "en").some((p) => p.kind === "unsupported_number")).toBe(true);
  });

  test("rejects the wrong language and unknown keys", () => {
    expect(draftProblems(baseDraft({ language: "ar" }), brief, "en")).toContainEqual({ kind: "wrong_language" });
    const result = validateDraft({ ...baseDraft(), price: "$1" }, brief, "en");
    expect(result.ok).toBe(false);
  });

  test("Arabic evidence matches despite diacritics, alef forms and Arabic-Indic digits", () => {
    expect(normalizeForMatch("كتيّب مطبوع")).toBe(normalizeForMatch("كتيب مطبوع"));
    expect(normalizeForMatch("أولياء")).toBe(normalizeForMatch("اولياء"));
    expect(normalizeForMatch("١٢ فرعًا")).toBe(normalizeForMatch("12 فرعا"));
  });
});

describe("mock generator on synthetic briefs", () => {
  test.each(SYNTHETIC_BRIEFS.map((b) => [b.id, b] as const))("%s: produces a valid, clearly labelled Pre-meeting Pack", async (_id, brief) => {
    const input = buildGenerationInput(brief.inquiry);
    const result = await createMockGenerator().generate(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const validation = validatePack(result.raw, { brief: input.brief, language: input.language, projectType: input.projectType });
    expect(validation.ok, JSON.stringify(validation)).toBe(true);
    if (validation.ok) {
      expect(validation.pack.proposal.understanding.startsWith("[MOCK]")).toBe(true);
      // A clear project type gets a library pattern; "not sure" falls back to a hand-made design.
      expect(validation.pack.design_blueprint.pattern === null).toBe(!["website", "web_app", "mobile_app"].includes(input.projectType ?? ""));
    }
  });
});

// A fetch double for the CodeCraft adapter.
const respond = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  vi.fn(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers }));
const completion = (content: string, extra: Record<string, unknown> = {}) => ({
  model: "provider-model-x",
  choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }],
  usage: { prompt_tokens: 900, completion_tokens: 600, total_tokens: 1500 },
  ...extra,
});
const KEY = "cc-test-key-should-never-leak";
const adapter = (fetchImpl: typeof fetch, timeoutMs = 2000) =>
  createCodeCraftGenerator({ apiKey: KEY, baseUrl: "https://gateway.test/v1/", model: "configured-model", maxOutputTokens: 3000, timeoutMs, fetchImpl });
const input = buildGenerationInput(clinic.inquiry);

describe("CodeCraft adapter", () => {
  test("sends the configured model, JSON mode and a bearer key; returns JSON and reported usage", async () => {
    const fetchImpl = respond(200, completion(JSON.stringify(baseDraft())));
    const result = await adapter(fetchImpl as unknown as typeof fetch).generate(input);
    expect(result).toMatchObject({ ok: true, model: "provider-model-x", usage: { totalTokens: 1500, reported: true } });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://gateway.test/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ model: "configured-model", response_format: { type: "json_object" }, max_tokens: 3000, stream: false });
    expect(String(init.body)).not.toMatch(/jane@|Jane Doe/);
  });

  test("accepts JSON wrapped in a code fence", async () => {
    const result = await adapter(respond(200, completion("```json\n" + JSON.stringify(baseDraft()) + "\n```")) as unknown as typeof fetch).generate(input);
    expect(result.ok).toBe(true);
  });

  test.each([
    ["402 exhausted allowance pauses", 402, {}, { failure: "quota_exhausted", pauseAutomation: true, retryable: false }],
    ["quota wording on another status pauses", 403, { error: { message: "Insufficient balance" } }, { failure: "quota_exhausted", pauseAutomation: true }],
    ["401 bad key pauses", 401, {}, { failure: "auth_failed", pauseAutomation: true, retryable: false }],
    ["404 unknown model pauses", 404, {}, { failure: "model_unavailable", pauseAutomation: true }],
    ["500 retries", 500, {}, { failure: "provider_error", retryable: true, pauseAutomation: false }],
  ])("%s", async (_name, status, body, expected) => {
    expect(await adapter(respond(status, body) as unknown as typeof fetch).generate(input)).toMatchObject(expected);
  });

  test("429 retries after the provider's Retry-After", async () => {
    const result = await adapter(respond(429, {}, { "retry-after": "120" }) as unknown as typeof fetch).generate(input);
    expect(result).toMatchObject({ failure: "rate_limited", retryable: true, retryAfterSeconds: 120 });
  });

  test("times out and retries", async () => {
    const hanging = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted")))));
    const result = await adapter(hanging as unknown as typeof fetch, 50).generate(input);
    expect(result).toMatchObject({ failure: "timeout", retryable: true });
  });

  test.each([
    ["no choices", { usage: { total_tokens: 10 } }, "malformed_response"],
    ["not JSON content", completion("Here is your draft: ..."), "invalid_output"],
    ["cut off at max tokens", completion("{", { choices: [{ message: { content: "{" }, finish_reason: "length" }] }), "truncated"],
  ])("%s -> %s", async (_name, body, failure) => {
    expect(await adapter(respond(200, body) as unknown as typeof fetch).generate(input)).toMatchObject({ ok: false, failure });
  });

  test("missing usage is estimated conservatively and marked as not reported", async () => {
    const result = await adapter(respond(200, { choices: [{ message: { content: JSON.stringify(baseDraft()) }, finish_reason: "stop" }] }) as unknown as typeof fetch).generate(input);
    expect(result.ok && result.usage.reported).toBe(false);
    expect(result.ok && result.usage.totalTokens).toBeGreaterThanOrEqual(3000);
  });

  test("the key never appears in any result", async () => {
    for (const status of [200, 401, 402, 429, 500]) {
      const result = await adapter(respond(status, status === 200 ? completion("{}") : { error: KEY }) as unknown as typeof fetch).generate(input);
      expect(JSON.stringify(result)).not.toContain(KEY);
    }
  });
});

describe("generator selection", () => {
  test("off unless explicitly chosen", () => {
    expect(selectGenerator({})).toEqual({ enabled: false, reason: "off" });
    expect(selectGenerator({ PREPARATION_GENERATOR: "mock" }).enabled).toBe(true);
  });

  test("CodeCraft needs a key, an exact model id, and approval before real client data", () => {
    const base = { PREPARATION_GENERATOR: "codecraft" };
    expect(selectGenerator(base)).toMatchObject({ reason: "missing_api_key" });
    expect(selectGenerator({ ...base, CODECRAFT_API_KEY: "k" })).toMatchObject({ reason: "missing_model" });
    expect(selectGenerator({ ...base, CODECRAFT_API_KEY: "k", CODECRAFT_MODEL: "m" })).toMatchObject({ reason: "client_data_not_approved" });
    expect(selectGenerator({ ...base, CODECRAFT_API_KEY: "k", CODECRAFT_MODEL: "m" }, { syntheticOnly: true }).enabled).toBe(true);
    expect(selectGenerator({ ...base, CODECRAFT_API_KEY: "k", CODECRAFT_MODEL: "m", CODECRAFT_CLIENT_DATA_APPROVED: "true" }).enabled).toBe(true);
  });

  test("the monthly budget can never be set above the free allowance", () => {
    const s = selectGenerator({ PREPARATION_GENERATOR: "mock", PREPARATION_MONTHLY_TOKEN_BUDGET: "5000000" });
    expect(s.enabled && s.monthlyTokenBudget).toBe(600_000);
  });
});

// An in-memory store recording what the worker asks for.
function fakeStore(over: Partial<PreparationStore> = {}) {
  const calls: string[] = [];
  const store: PreparationStore = {
    claim: async () => [{ inquiryId: "inq-1", attempts: 1 }],
    claimInquiry: async (_provider, id) => (calls.push(`claimInquiry:${id}`), [{ inquiryId: id, attempts: 1 }]),
    loadInquiry: async () => clinic.inquiry,
    complete: async (id, _content, source) => (calls.push(`complete:${id}:${source}`), 1),
    completePack: async (id, artifacts, source) => (calls.push(`completePack:${id}:${source}:${Object.keys(artifacts).join("+")}`), 3),
    recordPayload: async (id) => void calls.push(`payload:${id}`),
    fail: async (id, error, retryable) => (calls.push(`fail:${id}:${error}:${retryable}`), retryable ? "retry_scheduled" : "failed"),
    pause: async (provider, reason) => void calls.push(`pause:${provider}:${reason}`),
    monthlyTokens: async () => 0,
    recordUsage: async (e) => void calls.push(`usage:${e.outcome}:${e.totalTokens}`),
    ...over,
  };
  return { store, calls };
}
const fixedGenerator = (result: Awaited<ReturnType<PreparationGenerator["generate"]>>, estimate = 4000): PreparationGenerator & { generate: ReturnType<typeof vi.fn> } => ({
  id: "codecraft",
  model: "m",
  estimateTokens: () => estimate,
  generate: vi.fn(async () => result),
});

describe("worker", () => {
  test("saves a validated draft and records usage", async () => {
    const { store, calls } = fakeStore();
    const generator = fixedGenerator({ ok: true, raw: clinicPack(), model: "m", usage: { promptTokens: 900, completionTokens: 600, totalTokens: 1500, reported: true } });
    const summary = await runPreparationBatch({ store, generator, monthlyTokenBudget: 600_000 });
    expect(summary).toMatchObject({ claimed: 1, succeeded: 1 });
    expect(calls).toEqual(["payload:inq-1", "usage:succeeded:1500", "completePack:inq-1:codecraft:design+proposal+discovery"]);
  });

  test("never saves a draft that breaks the rules; retries within the limit", async () => {
    const { store, calls } = fakeStore();
    const bad = clinicPack({ proposal: { ...clinicPack().proposal, next_step: "Quote $9,999." } });
    const summary = await runPreparationBatch({ store, generator: fixedGenerator({ ok: true, raw: bad, model: "m", usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2, reported: true } }), monthlyTokenBudget: 600_000 });
    expect(summary.retrying).toBe(1);
    expect(calls.some((c) => c.startsWith("complete"))).toBe(false);
    expect(calls).toContain("fail:inq-1:invalid_unsupported_number:true");
  });

  test("pauses on exhausted allowance and stops the batch", async () => {
    const { store, calls } = fakeStore({ claim: async () => [{ inquiryId: "inq-1", attempts: 1 }, { inquiryId: "inq-2", attempts: 1 }] });
    const generator = fixedGenerator({ ok: false, failure: "quota_exhausted", retryable: false, pauseAutomation: true });
    const summary = await runPreparationBatch({ store, generator, monthlyTokenBudget: 600_000 });
    expect(summary.paused).toBe(1);
    expect(generator.generate).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(["payload:inq-1", "pause:codecraft:quota_exhausted"]);
  });

  test("enforces the application budget before calling the provider", async () => {
    const { store, calls } = fakeStore({ monthlyTokens: async () => 598_000 });
    const generator = fixedGenerator({ ok: true, raw: clinicPack(), model: "m", usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, reported: true } }, 4000);
    await runPreparationBatch({ store, generator, monthlyTokenBudget: 600_000 });
    expect(generator.generate).not.toHaveBeenCalled();
    expect(calls).toEqual(["pause:codecraft:budget_exhausted"]);
  });

  test("rate limits are retried later, with usage recorded when reported", async () => {
    const { store, calls } = fakeStore();
    await runPreparationBatch({ store, generator: fixedGenerator({ ok: false, failure: "rate_limited", retryable: true, pauseAutomation: false, retryAfterSeconds: 120 }), monthlyTokenBudget: 600_000 });
    expect(calls).toEqual(["payload:inq-1", "fail:inq-1:rate_limited:true"]);
  });

  test("a missing inquiry fails visibly without calling the provider", async () => {
    const { store, calls } = fakeStore({ loadInquiry: async () => null });
    const generator = fixedGenerator({ ok: true, raw: {}, model: "m", usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, reported: true } });
    await runPreparationBatch({ store, generator, monthlyTokenBudget: 600_000 });
    expect(generator.generate).not.toHaveBeenCalled();
    expect(calls).toEqual(["fail:inq-1:inquiry_missing:false"]);
  });

  test("can be limited to one inquiry", async () => {
    const { store, calls } = fakeStore();
    await runPreparationBatch({ store, generator: createMockGenerator(), monthlyTokenBudget: 0, inquiryId: "inq-9" });
    expect(calls).toEqual(["claimInquiry:inq-9", "completePack:inq-9:mock:design+proposal+discovery"]);
  });

  test("the mock generator runs end to end without usage or budget", async () => {
    const { store, calls } = fakeStore({ monthlyTokens: async () => 10_000_000 });
    const summary = await runPreparationBatch({ store, generator: createMockGenerator(), monthlyTokenBudget: 0 });
    expect(summary.succeeded).toBe(1);
    expect(calls).toEqual(["completePack:inq-1:mock:design+proposal+discovery"]);
  });
});
