import type { PreparationGenerator } from "./generator";
import { createMockGenerator } from "./mock-generator";
import { createCodeCraftGenerator } from "./codecraft-generator";

// Which generator the worker uses, from server-side environment variables.
// Off unless explicitly chosen; CodeCraft additionally needs an exact model ID
// (no default, never guessed) and an explicit go-ahead before it may see real
// client inquiries.
//
//   PREPARATION_GENERATOR              off | mock | codecraft   (default off)
//   CODECRAFT_API_KEY                  secret, server only
//   CODECRAFT_BASE_URL                 default https://codecraftapi.com/v1
//   CODECRAFT_MODEL                    exact model id from GET /models
//   CODECRAFT_CLIENT_DATA_APPROVED     "true" only once the model's upstream
//                                      provider and data terms are verified
//   PREPARATION_MONTHLY_TOKEN_BUDGET   default 600000 (free tier is 1M in+out)
//   PREPARATION_MAX_OUTPUT_TOKENS      default 6000 (a Pre-meeting Pack)
//   CODECRAFT_TIMEOUT_MS               default 60000

export type Env = Record<string, string | undefined>;

export type GeneratorSelection =
  | { enabled: true; generator: PreparationGenerator; monthlyTokenBudget: number }
  | { enabled: false; reason: "off" | "missing_api_key" | "missing_model" | "client_data_not_approved" | "unknown_generator" };

const int = (value: string | undefined, fallback: number, min: number, max: number) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

export const DEFAULT_CODECRAFT_BASE_URL = "https://codecraftapi.com/v1";

export function selectGenerator(env: Env = process.env, options: { syntheticOnly?: boolean } = {}): GeneratorSelection {
  const choice = (env.PREPARATION_GENERATOR ?? "off").trim().toLowerCase();
  const monthlyTokenBudget = int(env.PREPARATION_MONTHLY_TOKEN_BUDGET, 600_000, 0, 1_000_000);
  if (choice === "off" || choice === "") return { enabled: false, reason: "off" };
  if (choice === "mock") return { enabled: true, generator: createMockGenerator(), monthlyTokenBudget };
  if (choice !== "codecraft") return { enabled: false, reason: "unknown_generator" };

  const apiKey = env.CODECRAFT_API_KEY?.trim();
  const model = env.CODECRAFT_MODEL?.trim();
  if (!apiKey) return { enabled: false, reason: "missing_api_key" };
  if (!model) return { enabled: false, reason: "missing_model" };
  if (!options.syntheticOnly && env.CODECRAFT_CLIENT_DATA_APPROVED !== "true") return { enabled: false, reason: "client_data_not_approved" };

  return {
    enabled: true,
    monthlyTokenBudget,
    generator: createCodeCraftGenerator({
      apiKey,
      model,
      baseUrl: env.CODECRAFT_BASE_URL?.trim() || DEFAULT_CODECRAFT_BASE_URL,
      maxOutputTokens: int(env.PREPARATION_MAX_OUTPUT_TOKENS, 6000, 2048, 8192),
      timeoutMs: int(env.CODECRAFT_TIMEOUT_MS, 60_000, 5_000, 180_000),
    }),
  };
}
