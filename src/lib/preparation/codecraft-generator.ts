import type { GenerationInput } from "./input";
import type { CallMeta, GenerationFailure, GenerationResult, PreparationGenerator, Usage } from "./generator";
import { STEP_MAX_TOKENS, stepMessages, type PackStep, type StepContext } from "@/lib/pack/steps";

// CodeCraft API (https://codecraftapi.com/docs/chat-completions): an
// OpenAI-style gateway. Documented: POST {base}/chat/completions with model,
// messages, max_tokens, temperature and response_format {type: "json_object"};
// the response carries choices[0].message.content (and, for reasoning models,
// reasoning_content) and usage; reasoning tokens count toward completion_tokens
// and max_tokens below 2,048 is raised to 2,048. A spent allowance with an empty
// balance answers 402. CodeCraft does not host the models and does not say which
// upstream provider serves one; every model lists owned_by "CodeCraft API".
// Not documented, so handled defensively: the auth header (sent as a Bearer
// token), error bodies, rate-limit headers and timeouts.
//
// The key is only ever read here, server-side. Nothing from a response, a
// prompt or the key is returned or logged: failures are categories, and call
// metadata is lengths, counts, the finish reason and the reported model name.

export interface CodeCraftConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  // Optional reasoning control passed through as the gateway's "reasoning" parameter.
  reasoning?: Record<string, unknown>;
  stepMaxTokens?: Partial<Record<PackStep, number>>;
  fetchImpl?: typeof fetch;
}

type Message = { role: "system" | "user"; content: string };

// Rough, deliberately high estimate (Arabic tokenizes densely) for budget checks.
export const estimatePromptTokens = (text: string) => Math.ceil(text.length / 2) + 200;

// Transient failures are retried; a cut-off or unusable answer is not (the same
// request would likely fail again and spend the allowance twice). Quota, key,
// model and model-mismatch problems pause automation for everyone.
export const TRANSIENT: readonly GenerationFailure[] = ["timeout", "rate_limited", "provider_error", "provider_unreachable", "malformed_response"];
const PAUSING: readonly GenerationFailure[] = ["quota_exhausted", "auth_failed", "model_unavailable", "model_mismatch"];

const fail = (failure: GenerationFailure, extra: Partial<Extract<GenerationResult, { ok: false }>> = {}): GenerationResult => ({
  ok: false,
  failure,
  retryable: TRANSIENT.includes(failure),
  pauseAutomation: PAUSING.includes(failure),
  ...extra,
});

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);

function flatten(value: unknown, prefix: string, out: Record<string, number>) {
  if (!value || typeof value !== "object") return;
  for (const [k, v] of Object.entries(value)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (num(v) !== null) out[key] = num(v)!;
    else if (v && typeof v === "object") flatten(v, key, out);
  }
}

function usageFrom(fields: Record<string, number>, fallbackPrompt: number, fallbackCompletion: number): Usage {
  const prompt = fields.prompt_tokens ?? null;
  const completion = fields.completion_tokens ?? null;
  const total = fields.total_tokens ?? null;
  const reasoning = fields["completion_tokens_details.reasoning_tokens"] ?? fields.reasoning_tokens ?? null;
  if (prompt === null && completion === null && total === null) {
    return { promptTokens: fallbackPrompt, completionTokens: fallbackCompletion, totalTokens: fallbackPrompt + fallbackCompletion, reasoningTokens: null, reported: false };
  }
  const p = prompt ?? 0;
  const c = completion ?? 0;
  return { promptTokens: p, completionTokens: c, totalTokens: total ?? p + c, reasoningTokens: reasoning, reported: true };
}

// The reply must come from the model that was asked for (a dated snapshot of it
// is accepted). Anything else is never used: a different model must not receive
// or answer for client data without anyone choosing it.
export const sameModel = (requested: string, returned: string | null) =>
  returned === null || returned === requested || returned.startsWith(`${requested}-`) || returned.startsWith(`${requested}@`);

const PROVIDER_FIELD = /provider|upstream|route|origin|served|vendor|fingerprint/i;

// One JSON chat request with its own output ceiling.
export async function chatJson(config: CodeCraftConfig, messages: Message[], maxTokens: number): Promise<GenerationResult> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const endpoint = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const promptEstimate = estimatePromptTokens(messages.map((m) => m.content).join("\n"));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  const started = Date.now();
  const meta: CallMeta = { requestedModel: config.model, returnedModel: null, maxTokens, finishReason: null, contentChars: 0, reasoningChars: 0, usageFields: {}, providerHints: {}, keysSeen: [], ms: 0 };
  const done = () => ((meta.ms = Date.now() - started), meta);

  let response: Response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: maxTokens,
        temperature: 0.2,
        response_format: { type: "json_object" },
        stream: false,
        ...(config.reasoning ? { reasoning: config.reasoning } : {}),
      }),
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timer);
    return controller.signal.aborted ? fail("timeout", { meta: done() }) : fail("provider_unreachable", { meta: done() });
  }

  let bodyText = "";
  try {
    bodyText = await response.text();
  } catch {
    clearTimeout(timer);
    return controller.signal.aborted ? fail("timeout", { meta: done() }) : fail("provider_unreachable", { meta: done() });
  }
  clearTimeout(timer);
  response.headers.forEach((value, name) => {
    if (PROVIDER_FIELD.test(name)) meta.providerHints[`header:${name}`] = value.slice(0, 80);
  });

  let body: Record<string, unknown> | null = null;
  try {
    body = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    body = null;
  }

  if (!response.ok) {
    const lowered = bodyText.toLowerCase();
    const retryAfter = Number(response.headers.get("retry-after"));
    const retryAfterSeconds = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(Math.round(retryAfter), 3600) : undefined;
    if (response.status === 402 || /insufficient|quota|balance|credit|allowance/.test(lowered)) return fail("quota_exhausted", { meta: done() });
    if (response.status === 401 || response.status === 403) return fail("auth_failed", { meta: done() });
    if (response.status === 429) return fail("rate_limited", { retryAfterSeconds, meta: done() });
    if (response.status === 404 || (/model/.test(lowered) && response.status === 400)) return fail("model_unavailable", { meta: done() });
    if (response.status >= 500) return fail("provider_error", { retryAfterSeconds, meta: done() });
    return fail("malformed_response", { meta: done() });
  }

  flatten(body?.usage, "", meta.usageFields);
  for (const [k, v] of Object.entries(body ?? {})) if (PROVIDER_FIELD.test(k) && (typeof v === "string" || typeof v === "number")) meta.providerHints[k] = String(v).slice(0, 80);
  const usage = usageFrom(meta.usageFields, promptEstimate, maxTokens);
  const choice = (body?.choices as { message?: { content?: unknown; reasoning_content?: unknown; reasoning?: unknown }; finish_reason?: unknown }[] | undefined)?.[0];
  const content = choice?.message?.content;
  const reasoning = choice?.message?.reasoning_content ?? choice?.message?.reasoning;
  meta.finishReason = typeof choice?.finish_reason === "string" ? choice.finish_reason : null;
  meta.contentChars = typeof content === "string" ? content.length : 0;
  if (typeof content === "string") meta.keysSeen = [...new Set([...content.matchAll(/"([a-z_]{2,40})"\s*:/g)].map((m) => m[1]))].slice(0, 60);
  meta.reasoningChars = typeof reasoning === "string" ? reasoning.length : 0;
  meta.returnedModel = typeof body?.model === "string" ? (body.model as string).slice(0, 120) : null;
  const model = meta.returnedModel ?? config.model;
  done();

  if (!sameModel(config.model, meta.returnedModel)) return fail("model_mismatch", { usage, model, meta });
  if (typeof content !== "string") return fail("malformed_response", { usage, model, meta });
  if (meta.finishReason === "length") return fail("truncated", { usage, model, meta });

  // Some models wrap JSON in a code fence even in JSON mode.
  const json = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return { ok: true, raw: JSON.parse(json), model, usage, meta };
  } catch {
    return fail("invalid_output", { usage, model, meta });
  }
}

export function createCodeCraftGenerator(config: CodeCraftConfig): PreparationGenerator {
  const ceiling = (step: PackStep) => config.stepMaxTokens?.[step] ?? STEP_MAX_TOKENS[step];
  return {
    id: "codecraft",
    model: config.model,
    estimateTokens: (step, input, context) => estimatePromptTokens(stepMessages(step, input, context).map((m) => m.content).join("\n")) + ceiling(step),
    generate: (step: PackStep, input: GenerationInput, context: StepContext) => chatJson(config, stepMessages(step, input, context), ceiling(step)),
  };
}
