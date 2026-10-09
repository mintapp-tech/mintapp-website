import type { GenerationInput } from "./input";

// One interface for every way a preparation draft can be produced. A
// generator returns raw JSON; the worker validates it before anything is saved.

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  // False when the provider did not report usage and it had to be estimated.
  reported: boolean;
}

// Categories only: no provider message, prompt or key ever travels in these.
export type GenerationFailure =
  | "timeout"
  | "rate_limited"
  | "quota_exhausted"
  | "auth_failed"
  | "model_unavailable"
  | "provider_error"
  | "provider_unreachable"
  | "malformed_response"
  | "invalid_output"
  | "truncated";

export type GenerationResult =
  | { ok: true; raw: unknown; model: string; usage: Usage }
  | { ok: false; failure: GenerationFailure; retryable: boolean; pauseAutomation: boolean; retryAfterSeconds?: number; usage?: Usage; model?: string };

export interface PreparationGenerator {
  readonly id: "mock" | "codecraft";
  readonly model: string;
  // Worst-case tokens one request may use, for the budget check before calling.
  estimateTokens(input: GenerationInput): number;
  generate(input: GenerationInput): Promise<GenerationResult>;
}
