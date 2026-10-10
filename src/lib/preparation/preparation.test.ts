import { describe, expect, test, vi } from "vitest";
import { buildGenerationInput } from "./input";
import { draftProblems, normalizeForMatch, validateDraft, type PreparationDraft } from "./draft";
import { createMockGenerator } from "./mock-generator";
import { createCodeCraftGenerator, sameModel } from "./codecraft-generator";
import { selectGenerator } from "./config";
import { runPreparationBatch, type PackProgress, type PreparationStore } from "./worker";
import { SYNTHETIC_BRIEFS } from "./synthetic-briefs";
import type { GenerationResult, PreparationGenerator } from "./generator";
import { splitPack } from "@/lib/pack/schema";
import { PACK_STEPS, STEP_MAX_TOKENS, artifactFor, stepMessages, validateStep, type Analysis, type PackStep } from "@/lib/pack/steps";
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
    expect(input.brief).toContain("Estimated budget (client-stated): Not sure yet");
    expect(input.brief).not.toMatch(/Jane|jane@|\+20100000|Acme|acme\.test/);
  });

  test("Arabic inquiries are prepared in Arabic", () => {
    expect(buildGenerationInput(SYNTHETIC_BRIEFS[4].inquiry).brief).toMatch(/^نوع المشروع: /);
  });

  test("stored budget and timeline codes reach the brief as their meaning in the brief's language, never as codes", () => {
    const en = buildGenerationInput({ ...clinic.inquiry, budget_range: "5000_10000", timeline: "over_6_months" }).brief;
    expect(en).toContain("Estimated budget (client-stated): USD 5,000–10,000");
    expect(en).toContain("Timeline (client-stated): Later than 6 months");
    const ar = buildGenerationInput({ ...SYNTHETIC_BRIEFS[4].inquiry, budget_range: "under_2500", timeline: "asap" }).brief;
    expect(ar).toContain("الميزانية التقديرية (كما ذكرها العميل): أقل من 2,500 دولار أمريكي");
    expect(ar).toContain("في أقرب وقت ممكن");
    for (const brief of [en, ar]) expect(brief).not.toMatch(/5000_10000|over_6_months|under_2500|\basap\b|not_sure/);
    // An older row keeps working: its label is shown.
    expect(buildGenerationInput({ ...clinic.inquiry, budget_range: "USD 5,000 - 15,000" }).brief).toContain("USD 5,000–15,000");
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
  test.each(SYNTHETIC_BRIEFS.map((b) => [b.id, b] as const))("%s: four valid, clearly labelled steps", async (_id, brief) => {
    const input = buildGenerationInput(brief.inquiry);
    const ctx = { brief: input.brief, language: input.language, projectType: input.projectType };
    const generator = createMockGenerator();
    const context: { analysis?: Analysis } = {};
    for (const step of PACK_STEPS) {
      const result = await generator.generate(step, input, context);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const validation = validateStep(step, result.raw, ctx);
      expect(validation.ok, `${step} ${JSON.stringify(validation)}`).toBe(true);
      if (validation.ok && step === "analysis") context.analysis = validation.value as Analysis;
      if (validation.ok && step === "proposal") expect(JSON.stringify(validation.value)).toContain("[MOCK]");
      // A clear project type gets a library pattern; "not sure" falls back to a hand-made design.
      if (validation.ok && step === "design") {
        const pattern = (validation.value as { design_blueprint: { pattern: string | null } }).design_blueprint.pattern;
        expect(pattern === null).toBe(!["website", "web_app", "mobile_app"].includes(input.projectType ?? ""));
      }
    }
  });
});

describe("the four steps", () => {
  const input = buildGenerationInput(clinic.inquiry);
  const ctx = { brief: input.brief, language: input.language, projectType: input.projectType };
  const pack = clinicPack();
  const analysis = { language: pack.language, client_facts: pack.client_facts, assumptions: pack.assumptions, missing_information: pack.missing_information };

  test("each step's request carries only its own instructions, and the later ones the checked analysis", () => {
    const first = stepMessages("analysis", input, {});
    expect(first[0].content).toContain('"client_facts"');
    expect(first[0].content).not.toContain('"design_blueprint"');
    expect(first[1].content).toContain("three physiotherapy clinics");
    const design = stepMessages("design", input, { analysis });
    expect(design[0].content).toContain("Pattern catalogue:");
    expect(design[1].content).toContain("already checked");
    expect(() => stepMessages("proposal", input, {})).toThrow("analysis_required");
    expect(Object.values(STEP_MAX_TOKENS).every((n) => n >= 2048 && n <= 8000)).toBe(true);
  });

  test("each step is validated on its own rules", () => {
    expect(validateStep("analysis", analysis, ctx).ok).toBe(true);
    expect(validateStep("analysis", { ...analysis, client_facts: [{ text: "They have ten clinics", evidence: "We run ten clinics" }] }, ctx)).toMatchObject({ ok: false });
    expect(validateStep("design", { language: "en", design_blueprint: pack.design_blueprint, screens: pack.screens, user_flow: pack.user_flow }, ctx).ok).toBe(true);
    const proposal = { language: "en", proposal: { ...pack.proposal, next_step: "Quote $9,999." } };
    expect(validateStep("proposal", proposal, ctx)).toMatchObject({ ok: false, problems: [{ kind: "unsupported_number" }] });
    expect(validateStep("discovery", { language: "ar", discovery_questions: pack.discovery_questions, risks: [], client_decisions: [], meeting_agenda: pack.meeting_agenda, confirm_before_pricing: pack.confirm_before_pricing }, ctx)).toMatchObject({ ok: false, problems: [{ kind: "wrong_language" }] });
    // Unknown keys are refused.
    expect(validateStep("proposal", { language: "en", proposal: pack.proposal, price: "1" }, ctx).ok).toBe(false);
  });

  test("the three artifacts assembled from the steps match the single-object pack", () => {
    const whole = splitPack(pack);
    expect(artifactFor("design", { design_blueprint: pack.design_blueprint, screens: pack.screens, user_flow: pack.user_flow }, analysis)).toEqual(whole.design);
    expect(artifactFor("proposal", { proposal: pack.proposal }, analysis)).toEqual(whole.proposal);
    expect(artifactFor("discovery", pack, analysis)).toEqual(whole.discovery);
  });
});

// A fetch double for the CodeCraft adapter.
const respond = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  vi.fn(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers }));
const completion = (content: string, extra: Record<string, unknown> = {}) => ({
  model: "configured-model",
  choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }],
  usage: { prompt_tokens: 900, completion_tokens: 600, total_tokens: 1500, completion_tokens_details: { reasoning_tokens: 400 } },
  ...extra,
});
const KEY = "cc-test-key-should-never-leak";
const adapter = (fetchImpl: typeof fetch, timeoutMs = 2000, extra: Record<string, unknown> = {}) =>
  createCodeCraftGenerator({ apiKey: KEY, baseUrl: "https://gateway.test/v1/", model: "configured-model", timeoutMs, fetchImpl, ...extra });
const input = buildGenerationInput(clinic.inquiry);
const analysisJson = JSON.stringify({ language: "en", client_facts: [], assumptions: [], missing_information: [] });
const call = (g: PreparationGenerator) => g.generate("analysis", input, {});

describe("CodeCraft adapter", () => {
  test("one bounded request per step: the configured model, JSON mode, the step's ceiling and a bearer key", async () => {
    const fetchImpl = respond(200, completion(analysisJson));
    const result = await call(adapter(fetchImpl as unknown as typeof fetch));
    expect(result).toMatchObject({ ok: true, model: "configured-model", usage: { totalTokens: 1500, reasoningTokens: 400, reported: true } });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://gateway.test/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ model: "configured-model", response_format: { type: "json_object" }, max_tokens: STEP_MAX_TOKENS.analysis, stream: false });
    expect(body.reasoning).toBeUndefined();
    expect(String(init.body)).not.toMatch(/jane@|Jane Doe/);
  });

  test("records what the call looked like, never its content: finish reason, usage fields, lengths, key names", async () => {
    const result = await call(adapter(respond(200, completion(analysisJson)) as unknown as typeof fetch));
    expect(result.meta).toMatchObject({ requestedModel: "configured-model", returnedModel: "configured-model", finishReason: "stop", maxTokens: STEP_MAX_TOKENS.analysis });
    expect(result.meta?.usageFields).toMatchObject({ prompt_tokens: 900, "completion_tokens_details.reasoning_tokens": 400 });
    expect(result.meta?.keysSeen).toEqual(["language", "client_facts", "assumptions", "missing_information"]);
    expect(JSON.stringify(result.meta)).not.toContain("physiotherapy");
  });

  test("passes a reasoning budget through when configured", async () => {
    const fetchImpl = respond(200, completion(analysisJson));
    await call(adapter(fetchImpl as unknown as typeof fetch, 2000, { reasoning: { max_tokens: 1024 } }));
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).reasoning).toEqual({ max_tokens: 1024 });
  });

  test("accepts JSON wrapped in a code fence", async () => {
    expect((await call(adapter(respond(200, completion("```json\n" + analysisJson + "\n```")) as unknown as typeof fetch))).ok).toBe(true);
  });

  test.each([
    ["402 exhausted allowance pauses", 402, {}, { failure: "quota_exhausted", pauseAutomation: true, retryable: false }],
    ["quota wording on another status pauses", 403, { error: { message: "Insufficient balance" } }, { failure: "quota_exhausted", pauseAutomation: true }],
    ["401 bad key pauses", 401, {}, { failure: "auth_failed", pauseAutomation: true, retryable: false }],
    ["404 unknown model pauses", 404, {}, { failure: "model_unavailable", pauseAutomation: true }],
    ["500 retries", 500, {}, { failure: "provider_error", retryable: true, pauseAutomation: false }],
  ])("%s", async (_name, status, body, expected) => {
    expect(await call(adapter(respond(status, body) as unknown as typeof fetch))).toMatchObject(expected);
  });

  test("429 retries after the provider's Retry-After", async () => {
    expect(await call(adapter(respond(429, {}, { "retry-after": "120" }) as unknown as typeof fetch))).toMatchObject({ failure: "rate_limited", retryable: true, retryAfterSeconds: 120 });
  });

  test("times out and retries", async () => {
    const hanging = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted")))));
    expect(await call(adapter(hanging as unknown as typeof fetch, 50))).toMatchObject({ failure: "timeout", retryable: true });
  });

  test.each([
    ["no choices", { model: "configured-model", usage: { total_tokens: 10 } }, "malformed_response", true],
    ["not JSON content", completion("Here is your draft: ..."), "invalid_output", false],
    ["cut off at the step's ceiling", completion("", { choices: [{ message: { content: "" }, finish_reason: "length" }] }), "truncated", false],
  ])("%s -> %s (retried: %s)", async (_name, body, failure, retryable) => {
    expect(await call(adapter(respond(200, body) as unknown as typeof fetch))).toMatchObject({ ok: false, failure, retryable, pauseAutomation: false });
  });

  test("a reply from any other model is refused and pauses automation; a dated snapshot of the same model is accepted", async () => {
    expect(await call(adapter(respond(200, completion(analysisJson, { model: "another-model" })) as unknown as typeof fetch))).toMatchObject({ ok: false, failure: "model_mismatch", pauseAutomation: true });
    expect((await call(adapter(respond(200, completion(analysisJson, { model: "configured-model-20261001" })) as unknown as typeof fetch))).ok).toBe(true);
    expect(sameModel("claude-sonnet-5", "claude-sonnet-5")).toBe(true);
    expect(sameModel("claude-sonnet-5", "gemini-3.7-flash")).toBe(false);
  });

  test("missing usage is estimated conservatively and marked as not reported", async () => {
    const result = await call(adapter(respond(200, { model: "configured-model", choices: [{ message: { content: analysisJson }, finish_reason: "stop" }] }) as unknown as typeof fetch));
    expect(result.ok && result.usage.reported).toBe(false);
    expect(result.ok && result.usage.totalTokens).toBeGreaterThanOrEqual(STEP_MAX_TOKENS.analysis);
  });

  test("the key never appears in any result", async () => {
    for (const status of [200, 401, 402, 429, 500]) {
      const result = await call(adapter(respond(status, status === 200 ? completion("{}") : { error: KEY }) as unknown as typeof fetch));
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

  test("exactly one model, with a reasoning budget by default and no fallback setting", async () => {
    const fetchImpl = respond(200, completion(analysisJson, { model: "claude-sonnet-5" }));
    const s = selectGenerator({ PREPARATION_GENERATOR: "codecraft", CODECRAFT_API_KEY: "k", CODECRAFT_MODEL: "claude-sonnet-5" }, { syntheticOnly: true });
    expect(s.enabled && s.generator.model).toBe("claude-sonnet-5");
    // The adapter's own fetch is replaced to read what selection configured.
    const g = s.enabled ? s.generator : null;
    expect(g).not.toBeNull();
    const configured = createCodeCraftGenerator({ apiKey: "k", baseUrl: "https://gateway.test/v1", model: "claude-sonnet-5", timeoutMs: 1000, reasoning: { max_tokens: 1024 }, fetchImpl: fetchImpl as unknown as typeof fetch });
    await call(configured);
    expect(JSON.parse(String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body)).model).toBe("claude-sonnet-5");
  });

  test("the monthly budget can never be set above the free allowance; the per-pack cap is bounded", () => {
    const s = selectGenerator({ PREPARATION_GENERATOR: "mock", PREPARATION_MONTHLY_TOKEN_BUDGET: "5000000", PREPARATION_PACK_TOKEN_CAP: "999999" });
    expect(s.enabled && s.monthlyTokenBudget).toBe(600_000);
    expect(s.enabled && s.packTokenCap).toBe(30_000);
  });
});

// An in-memory store recording what the worker asks for.
function fakeStore(over: Partial<PreparationStore> = {}) {
  const calls: string[] = [];
  let progress: PackProgress | null = null;
  const store: PreparationStore = {
    claim: async () => [{ inquiryId: "inq-1", attempts: 1 }],
    claimInquiry: async (_provider, id) => (calls.push(`claimInquiry:${id}`), [{ inquiryId: id, attempts: 1 }]),
    loadInquiry: async () => clinic.inquiry,
    loadProgress: async () => progress,
    saveProgress: async (_id, p) => void (progress = JSON.parse(JSON.stringify(p))),
    saveArtifact: async (id, artifact, _content, source) => (calls.push(`save:${artifact}:${source}`), 1),
    finishPack: async (id) => void calls.push(`finish:${id}`),
    recordPayload: async (id) => void calls.push(`payload:${id}`),
    fail: async (id, error, retryable) => (calls.push(`fail:${id}:${error}:${retryable}`), retryable ? "retry_scheduled" : "failed"),
    pause: async (provider, reason) => void calls.push(`pause:${provider}:${reason}`),
    monthlyTokens: async () => 0,
    recordUsage: async (e) => void calls.push(`usage:${e.outcome}:${e.totalTokens}`),
    ...over,
  };
  return { store, calls, progress: () => progress };
}

const pack = clinicPack();
const STEP_RAW: Record<PackStep, unknown> = {
  analysis: { language: "en", client_facts: pack.client_facts, assumptions: pack.assumptions, missing_information: pack.missing_information },
  design: { language: "en", design_blueprint: pack.design_blueprint, screens: pack.screens, user_flow: pack.user_flow },
  proposal: { language: "en", proposal: pack.proposal },
  discovery: { language: "en", discovery_questions: pack.discovery_questions, risks: pack.risks, client_decisions: pack.client_decisions, meeting_agenda: pack.meeting_agenda, confirm_before_pricing: pack.confirm_before_pricing },
};
const ok = (step: PackStep, total = 1000): GenerationResult => ({ ok: true, raw: STEP_RAW[step], model: "m", usage: { promptTokens: total / 2, completionTokens: total / 2, totalTokens: total, reported: true } });
// A generator whose answer per step can be overridden; it records which steps were asked.
function stepGenerator(over: Partial<Record<PackStep, GenerationResult>> = {}, estimate = 5000) {
  const asked: PackStep[] = [];
  const generator: PreparationGenerator = {
    id: "codecraft",
    model: "m",
    estimateTokens: () => estimate,
    generate: async (step) => (asked.push(step), over[step] ?? ok(step)),
  };
  return { generator, asked };
}
const failure = (f: GenerationResult & { ok: false }) => f;

describe("worker: four bounded steps", () => {
  test("saves each artifact as its step validates, records usage per step, then finishes the pack", async () => {
    const { store, calls, progress } = fakeStore();
    const { generator, asked } = stepGenerator();
    const summary = await runPreparationBatch({ store, generator, monthlyTokenBudget: 600_000 });
    expect(summary).toMatchObject({ claimed: 1, succeeded: 1 });
    expect(asked).toEqual(["analysis", "design", "proposal", "discovery"]);
    expect(calls).toEqual([
      "payload:inq-1",
      "usage:analysis:succeeded:1000",
      "usage:design:succeeded:1000",
      "save:design:codecraft",
      "usage:proposal:succeeded:1000",
      "save:proposal:codecraft",
      "usage:discovery:succeeded:1000",
      "save:discovery:codecraft",
      "finish:inq-1",
    ]);
    expect(progress()?.tokens).toBe(4000);
  });

  test("a step that is cut off keeps the others: two artifacts saved, the design left for a person, not retried", async () => {
    const { store, calls, progress } = fakeStore();
    const { generator } = stepGenerator({ design: failure({ ok: false, failure: "truncated", retryable: false, pauseAutomation: false, usage: { promptTokens: 1500, completionTokens: 6000, totalTokens: 7500, reported: true } }) });
    const summary = await runPreparationBatch({ store, generator, monthlyTokenBudget: 600_000 });
    expect(summary.failed).toBe(1);
    expect(calls.filter((c) => c.startsWith("save:"))).toEqual(["save:proposal:codecraft", "save:discovery:codecraft"]);
    expect(calls).toContain("fail:inq-1:truncated:false");
    expect(progress()?.steps).toEqual({ analysis: "done", design: "failed", proposal: "done", discovery: "done" });
  });

  test("a transient failure is retried later for that step only", async () => {
    const { store, calls, progress } = fakeStore();
    const first = stepGenerator({ proposal: failure({ ok: false, failure: "rate_limited", retryable: true, pauseAutomation: false, retryAfterSeconds: 120 }) });
    expect((await runPreparationBatch({ store, generator: first.generator, monthlyTokenBudget: 600_000 })).retrying).toBe(1);
    expect(calls).toContain("fail:inq-1:rate_limited:true");
    expect(progress()?.steps.proposal).toBeUndefined();
    // The next attempt asks for the proposal alone and completes the pack.
    const second = stepGenerator();
    expect((await runPreparationBatch({ store, generator: second.generator, monthlyTokenBudget: 600_000 })).succeeded).toBe(1);
    expect(second.asked).toEqual(["proposal"]);
  });

  test("without a checked analysis nothing else is asked", async () => {
    const { store, calls } = fakeStore();
    const { generator, asked } = stepGenerator({ analysis: failure({ ok: false, failure: "provider_error", retryable: true, pauseAutomation: false }) });
    await runPreparationBatch({ store, generator, monthlyTokenBudget: 600_000 });
    expect(asked).toEqual(["analysis"]);
    expect(calls).toContain("fail:inq-1:provider_error:true");
  });

  test("an answer that breaks the rules is never saved and not retried automatically", async () => {
    const { store, calls } = fakeStore();
    const bad: GenerationResult = { ok: true, raw: { language: "en", proposal: { ...pack.proposal, next_step: "Quote $9,999." } }, model: "m", usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2, reported: true } };
    await runPreparationBatch({ store, generator: stepGenerator({ proposal: bad }).generator, monthlyTokenBudget: 600_000 });
    expect(calls).not.toContain("save:proposal:codecraft");
    expect(calls).toContain("usage:proposal:invalid_unsupported_number:2");
    expect(calls).toContain("fail:inq-1:invalid_unsupported_number:false");
  });

  test("the per-pack cap is never exceeded: a step whose worst case does not fit is not sent", async () => {
    const { store, calls, progress } = fakeStore();
    // 4 x 5,000 worst case against a 12,000 cap: two steps fit after the analysis.
    const { generator, asked } = stepGenerator({}, 5000);
    const big = (step: PackStep) => ok(step, 5000);
    generator.generate = async (step) => (asked.push(step), big(step));
    await runPreparationBatch({ store, generator, monthlyTokenBudget: 600_000, packTokenCap: 12_000 });
    expect(asked).toEqual(["analysis", "design"]);
    expect(progress()?.tokens).toBeLessThanOrEqual(12_000);
    expect(progress()?.failures).toMatchObject({ proposal: "pack_budget", discovery: "pack_budget" });
    expect(calls).toContain("fail:inq-1:pack_budget:false");
  });

  test("pauses on an exhausted allowance or a different model, and stops the batch", async () => {
    for (const f of ["quota_exhausted", "model_mismatch"] as const) {
      const { store, calls } = fakeStore({ claim: async () => [{ inquiryId: "inq-1", attempts: 1 }, { inquiryId: "inq-2", attempts: 1 }] });
      const { generator, asked } = stepGenerator({ design: failure({ ok: false, failure: f, retryable: false, pauseAutomation: true }) });
      const summary = await runPreparationBatch({ store, generator, monthlyTokenBudget: 600_000 });
      expect(summary.paused).toBe(1);
      expect(asked).toEqual(["analysis", "design"]);
      expect(calls).toContain(`pause:codecraft:${f}`);
      expect(calls.some((c) => c.includes("inq-2"))).toBe(false);
    }
  });

  test("enforces the monthly budget before every request", async () => {
    const { store, calls } = fakeStore({ monthlyTokens: async () => 598_000 });
    const { generator, asked } = stepGenerator({}, 4000);
    await runPreparationBatch({ store, generator, monthlyTokenBudget: 600_000 });
    expect(asked).toEqual([]);
    expect(calls).toEqual(["payload:inq-1", "pause:codecraft:budget_exhausted"]);
  });

  test("a missing inquiry fails visibly without calling the provider", async () => {
    const { store, calls } = fakeStore({ loadInquiry: async () => null });
    const { generator, asked } = stepGenerator();
    await runPreparationBatch({ store, generator, monthlyTokenBudget: 600_000 });
    expect(asked).toEqual([]);
    expect(calls).toEqual(["fail:inq-1:inquiry_missing:false"]);
  });

  test("the mock generator runs end to end without usage or budget, and can be limited to one inquiry", async () => {
    const { store, calls } = fakeStore({ monthlyTokens: async () => 10_000_000 });
    const summary = await runPreparationBatch({ store, generator: createMockGenerator(), monthlyTokenBudget: 0, inquiryId: "inq-9" });
    expect(summary.succeeded).toBe(1);
    expect(calls).toEqual(["claimInquiry:inq-9", "save:design:mock", "save:proposal:mock", "save:discovery:mock", "finish:inq-9"]);
  });
});
