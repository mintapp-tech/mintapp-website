import type { Stage } from "./types";

// The commercial position as the founders see it: seven steps, with Closed split
// into Won and Lost. The database keeps its thirteen values (and their history);
// this maps both ways. Meeting and preparation are separate states shown beside it.

export const SIMPLE_STAGES = ["new", "reviewing", "meeting", "qualified", "proposal", "decision", "won", "lost"] as const;
export type SimpleStage = (typeof SIMPLE_STAGES)[number];

// The board's columns: Closed holds Won and Lost.
export const BOARD_COLUMNS = ["new", "reviewing", "meeting", "qualified", "proposal", "decision", "closed"] as const;
export type BoardColumn = (typeof BOARD_COLUMNS)[number];

const FROM_DB: Record<Stage, SimpleStage> = {
  new: "new",
  reviewing: "reviewing",
  meeting_booked: "meeting",
  preparing: "meeting",
  meeting_ready: "meeting",
  meeting_completed: "meeting",
  qualified: "qualified",
  proposal_prep: "proposal",
  proposal_sent: "proposal",
  negotiation: "decision",
  won: "won",
  lost: "lost",
  // A legacy value: pausing is now a flag with a resume date, not a stage.
  paused: "reviewing",
};

const TO_DB: Record<SimpleStage, Stage> = {
  new: "new",
  reviewing: "reviewing",
  meeting: "meeting_booked",
  qualified: "qualified",
  proposal: "proposal_prep",
  decision: "negotiation",
  won: "won",
  lost: "lost",
};

export const simpleStage = (stage: string): SimpleStage => FROM_DB[stage as Stage] ?? "new";
export const boardColumn = (stage: string): BoardColumn => {
  const s = simpleStage(stage);
  return s === "won" || s === "lost" ? "closed" : s;
};
export const isSimpleStage = (value: unknown): value is SimpleStage => typeof value === "string" && (SIMPLE_STAGES as readonly string[]).includes(value);

// The database value to write, or null when the lead is already in that step (a
// detailed value such as "meeting_completed" is kept rather than overwritten).
export function stageToWrite(current: string, chosen: SimpleStage): Stage | null {
  return simpleStage(current) === chosen ? null : TO_DB[chosen];
}

// Every database value that belongs to a simple step, for filtering.
export const dbStagesOf = (chosen: SimpleStage | "closed"): Stage[] =>
  (Object.keys(FROM_DB) as Stage[]).filter((s) => (chosen === "closed" ? ["won", "lost"].includes(FROM_DB[s]) : FROM_DB[s] === chosen) && s !== "paused");

export const isClosed = (stage: string) => ["won", "lost"].includes(simpleStage(stage));
