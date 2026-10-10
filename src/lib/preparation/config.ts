import type { PreparationGenerator } from "./generator";
import { createMockGenerator } from "./mock-generator";
import { createCodeCraftGenerator } from "./codecraft-generator";

// Which generator the worker uses, from server-side environment variables.
// Off unless explicitly chosen; CodeCraft additionally needs an exact model ID
// (no default, never guessed) and an explicit go-ahead before it may see real
// client inquiries. There is exactly one model: no fallback to another model,
// ever. If it fails, the pack waits for a person.
//
//   PREPARATION_GENERATOR              off | mock | codecraft   (default off)
//   CODECRAFT_API_KEY                  secret, server only
//   CODECRAFT_BASE_URL                 default https://codecraftapi.com/v1
//   CODECRAFT_MODEL                    exact model id from GET /models (the intended one is
//                                      Claude: claude-sonnet-5; see docs/two-founder-crm.md)
//   CODECRAFT_CLIENT_DATA_APPROVED     "true" only once the model's upstream
//                                      provider and data terms are verified
//   CODECRAFT_REASONING                unset (gateway default) | low | medium | high
//   CODECRAFT_REASONING_MAX_TOKENS     default 1024 (1024-8000): a reasoning budget, sent as
//                                      reasoning.max_tokens; without it the hidden reasoning can use
//                                      a whole step's ceiling and return nothing (see the evaluation)
//   PREPARATION_MONTHLY_TOKEN_BUDGET   default 600000, at most 1000000
//   PREPARATION_PACK_TOKEN_CAP         default 30000: all four requests of one pack together,
//                                      checked before each request against its worst case
//   CODECRAFT_TIMEOUT_MS               default 90000 per request

export type Env = Record<string, string | undefined>;

export type GeneratorSelection =
  | { enabled: true; generator: PreparationGenerator; monthlyTokenBudget: number; packTokenCap: number }
  | { enabled: false; reason: "off" | "missing_api_key" | "missing_model" | "client_data_not_approved" | "unknown_generator" };

const int = (value: string | undefined, fallback: number, min: number, max: number) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

export const DEFAULT_CODECRAFT_BASE_URL = "https://codecraftapi.com/v1";
const REASONING = ["low", "medium", "high"] as const;

export function selectGenerator(env: Env = process.env, options: { syntheticOnly?: boolean } = {}): GeneratorSelection {
  const choice = (env.PREPARATION_GENERATOR ?? "off").trim().toLowerCase();
  const monthlyTokenBudget = int(env.PREPARATION_MONTHLY_TOKEN_BUDGET, 600_000, 0, 1_000_000);
  const packTokenCap = int(env.PREPARATION_PACK_TOKEN_CAP, 30_000, 8_000, 60_000);
  if (choice === "off" || choice === "") return { enabled: false, reason: "off" };
  if (choice === "mock") return { enabled: true, generator: createMockGenerator(), monthlyTokenBudget, packTokenCap };
  if (choice !== "codecraft") return { enabled: false, reason: "unknown_generator" };

  const apiKey = env.CODECRAFT_API_KEY?.trim();
  const model = env.CODECRAFT_MODEL?.trim();
  if (!apiKey) return { enabled: false, reason: "missing_api_key" };
  if (!model) return { enabled: false, reason: "missing_model" };
  if (!options.syntheticOnly && env.CODECRAFT_CLIENT_DATA_APPROVED !== "true") return { enabled: false, reason: "client_data_not_approved" };
  const effort = env.CODECRAFT_REASONING?.trim().toLowerCase();
  const reasoningBudget = int(env.CODECRAFT_REASONING_MAX_TOKENS, 1024, 1024, 8000);
  const reasoning = {
    ...((REASONING as readonly string[]).includes(effort ?? "") ? { effort } : {}),
    ...(reasoningBudget ? { max_tokens: reasoningBudget } : {}),
  };

  return {
    enabled: true,
    monthlyTokenBudget,
    packTokenCap,
    generator: createCodeCraftGenerator({
      apiKey,
      model,
      baseUrl: env.CODECRAFT_BASE_URL?.trim() || DEFAULT_CODECRAFT_BASE_URL,
      timeoutMs: int(env.CODECRAFT_TIMEOUT_MS, 90_000, 5_000, 180_000),
      ...(Object.keys(reasoning).length ? { reasoning } : {}),
    }),
  };
}
