import type { GenerationInput } from "./input";
import type { PackStep, StepContext } from "@/lib/pack/steps";

// One interface for every way a Pre-meeting Pack step can be produced. A
// generator returns raw JSON for ONE step; the worker validates it before
// anything is saved.

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  // Hidden reasoning counted inside completionTokens, when the provider reports it.
  reasoningTokens?: number | null;
  // False when the provider did not report usage and it had to be estimated.
  reported: boolean;
}

// What a call looked like, for audit and diagnosis: never content, never the key.
export interface CallMeta {
  requestedModel: string;
  returnedModel: string | null;
  maxTokens: number;
  finishReason: string | null;
  // Lengths only (characters), to see whether reasoning used the allowance.
  contentChars: number;
  reasoningChars: number;
  // Every numeric usage field the provider reported, flattened (e.g. completion_tokens_details.reasoning_tokens).
  usageFields: Record<string, number>;
  // Response fields or headers that could name an upstream provider (names and values of those fields only).
  providerHints: Record<string, string>;
  // The JSON key names the reply reached, in order (names only), to locate where a cut-off happened.
  keysSeen: string[];
  ms: number;
}

// Categories only: no provider message, prompt or key ever travels in these.
export type GenerationFailure =
  | "timeout"
  | "rate_limited"
  | "quota_exhausted"
  | "auth_failed"
  | "model_unavailable"
  | "model_mismatch"
  | "provider_error"
  | "provider_unreachable"
  | "malformed_response"
  | "invalid_output"
  | "truncated";

export type GenerationResult =
  | { ok: true; raw: unknown; model: string; usage: Usage; meta?: CallMeta }
  | { ok: false; failure: GenerationFailure; retryable: boolean; pauseAutomation: boolean; retryAfterSeconds?: number; usage?: Usage; model?: string; meta?: CallMeta };

export interface PreparationGenerator {
  readonly id: "mock" | "codecraft";
  readonly model: string;
  // Worst-case tokens one step may use (prompt estimate plus its output ceiling), for budget checks before calling.
  estimateTokens(step: PackStep, input: GenerationInput, context: StepContext): number;
  generate(step: PackStep, input: GenerationInput, context: StepContext): Promise<GenerationResult>;
}
