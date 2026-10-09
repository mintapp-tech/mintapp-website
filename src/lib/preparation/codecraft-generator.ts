import type { GenerationInput } from "./input";
import type { GenerationFailure, GenerationResult, PreparationGenerator, Usage } from "./generator";
import { buildPackMessages as buildMessages } from "@/lib/pack/prompt";

// CodeCraft API (https://codecraftapi.com/docs/chat-completions): an
// OpenAI-style gateway. Documented: POST {base}/chat/completions with model,
// messages, max_tokens, temperature and response_format {type: "json_object"};
// the response carries choices[0].message.content and usage. A spent free
// allowance with an empty balance answers 402.
// Not documented, so handled defensively: the auth header (sent as a Bearer
// token), error bodies, rate-limit headers and timeouts.
//
// The key is only ever read here, server-side. Nothing from a response, a
// prompt or the key is returned or logged: failures are categories only.

export interface CodeCraftConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  maxOutputTokens: number;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

// Rough, deliberately high estimate (Arabic tokenizes densely) for budget checks.
export const estimatePromptTokens = (text: string) => Math.ceil(text.length / 2) + 200;

const fail = (failure: GenerationFailure, extra: Partial<Extract<GenerationResult, { ok: false }>> = {}): GenerationResult => ({
  ok: false,
  failure,
  // A cut-off answer is not retried: the same request is likely to be cut off again
  // and would spend the free allowance twice. Quota, key and model problems pause.
  retryable: ["timeout", "rate_limited", "provider_error", "provider_unreachable", "malformed_response", "invalid_output"].includes(failure),
  pauseAutomation: ["quota_exhausted", "auth_failed", "model_unavailable"].includes(failure),
  ...extra,
});

function usageFrom(body: unknown, fallbackPrompt: number, fallbackCompletion: number): Usage {
  const u = (body as { usage?: Record<string, unknown> } | null)?.usage;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);
  const prompt = n(u?.prompt_tokens);
  const completion = n(u?.completion_tokens);
  const total = n(u?.total_tokens);
  if (prompt === null && completion === null && total === null) {
    return { promptTokens: fallbackPrompt, completionTokens: fallbackCompletion, totalTokens: fallbackPrompt + fallbackCompletion, reported: false };
  }
  const p = prompt ?? 0;
  const c = completion ?? 0;
  return { promptTokens: p, completionTokens: c, totalTokens: total ?? p + c, reported: true };
}

export function createCodeCraftGenerator(config: CodeCraftConfig): PreparationGenerator {
  const fetchImpl = config.fetchImpl ?? fetch;
  const endpoint = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  return {
    id: "codecraft",
    model: config.model,
    estimateTokens: (input) => estimatePromptTokens(buildMessages(input).map((m) => m.content).join("\n")) + config.maxOutputTokens,

    async generate(input: GenerationInput): Promise<GenerationResult> {
      const messages = buildMessages(input);
      const promptEstimate = estimatePromptTokens(messages.map((m) => m.content).join("\n"));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.timeoutMs);

      let response: Response;
      try {
        response = await fetchImpl(endpoint, {
          method: "POST",
          headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            model: config.model,
            messages,
            max_tokens: config.maxOutputTokens,
            temperature: 0.2,
            response_format: { type: "json_object" },
            stream: false,
          }),
          signal: controller.signal,
        });
      } catch {
        clearTimeout(timer);
        return controller.signal.aborted ? fail("timeout") : fail("provider_unreachable");
      }

      let bodyText = "";
      try {
        bodyText = await response.text();
      } catch {
        clearTimeout(timer);
        return controller.signal.aborted ? fail("timeout") : fail("provider_unreachable");
      }
      clearTimeout(timer);

      let body: unknown = null;
      try {
        body = bodyText ? JSON.parse(bodyText) : null;
      } catch {
        body = null;
      }

      if (!response.ok) {
        const lowered = bodyText.toLowerCase();
        const retryAfter = Number(response.headers.get("retry-after"));
        const retryAfterSeconds = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(Math.round(retryAfter), 3600) : undefined;
        if (response.status === 402 || /insufficient|quota|balance|credit|allowance/.test(lowered)) return fail("quota_exhausted");
        if (response.status === 401 || response.status === 403) return fail("auth_failed");
        if (response.status === 429) return fail("rate_limited", { retryAfterSeconds });
        if (response.status === 404 || /model/.test(lowered) && response.status === 400) return fail("model_unavailable");
        if (response.status >= 500) return fail("provider_error", { retryAfterSeconds });
        return fail("malformed_response");
      }

      const usage = usageFrom(body, promptEstimate, config.maxOutputTokens);
      const choice = (body as { choices?: { message?: { content?: unknown }; finish_reason?: unknown }[] } | null)?.choices?.[0];
      const content = choice?.message?.content;
      const model = typeof (body as { model?: unknown } | null)?.model === "string" ? ((body as { model: string }).model.slice(0, 120)) : config.model;
      if (typeof content !== "string") return fail("malformed_response", { usage, model });
      if (choice?.finish_reason === "length") return fail("truncated", { usage, model });

      // Some models wrap JSON in a code fence even in JSON mode.
      const json = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      try {
        return { ok: true, raw: JSON.parse(json), model, usage };
      } catch {
        return fail("invalid_output", { usage, model });
      }
    },
  };
}
