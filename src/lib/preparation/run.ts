import "server-only";
import { getSqlGateway } from "@/lib/sql-gateway";
import { selectGenerator, type Env } from "./config";
import { createSqlPreparationStore } from "./sql-store";
import { runPreparationBatch, type BatchSummary } from "./worker";

export type RunOutcome = { ran: false; reason: string } | { ran: true; summary: BatchSummary };

// One worker pass with the configured generator. Does nothing unless a
// generator is explicitly enabled (PREPARATION_GENERATOR).
export async function runConfiguredPreparation(limit = 3, env: Env = process.env): Promise<RunOutcome> {
  const selection = selectGenerator(env);
  if (!selection.enabled) return { ran: false, reason: selection.reason };
  const summary = await runPreparationBatch({
    store: createSqlPreparationStore(getSqlGateway()),
    generator: selection.generator,
    monthlyTokenBudget: selection.monthlyTokenBudget,
    limit,
  });
  return { ran: true, summary };
}

// Best-effort start right after a submission. The job already exists (it is
// created with the inquiry), so if this fails or is skipped, the scheduled
// worker still picks it up. Never throws; logs a category only.
export async function kickPreparationAfterSubmission(): Promise<void> {
  try {
    await runConfiguredPreparation(1);
  } catch {
    console.error("preparation_kick_failed");
  }
}
