import { STAGES, type Stage } from "./types";

// The sales pipeline. These are the team's decisions about a deal, kept apart
// from the meeting (booking), the preparation and the draft review. Nothing in
// the application moves a stage because a booking was made, moved or cancelled.

export const CLOSED_STAGES: readonly Stage[] = ["won", "lost", "paused"];
export const isStage = (value: unknown): value is Stage => typeof value === "string" && (STAGES as readonly string[]).includes(value);
// Work still in progress: not won, lost or paused.
export const isOpenStage = (stage: string) => !(CLOSED_STAGES as readonly string[]).includes(stage);

// How far along the main path a stage is. Won/lost/paused are outcomes, not steps.
const RANK: Partial<Record<Stage, number>> = {
  new: 0, reviewing: 1, meeting_booked: 2, preparing: 3, meeting_ready: 4, meeting_completed: 5, qualified: 6, proposal_prep: 7, proposal_sent: 8, negotiation: 9, won: 10,
};
export const stageRank = (stage: string): number | null => RANK[stage as Stage] ?? null;

export type StageTone = "neutral" | "info" | "ok" | "warn" | "attention";
export const STAGE_TONES: Record<Stage, StageTone> = {
  new: "info",
  reviewing: "neutral",
  meeting_booked: "neutral",
  preparing: "neutral",
  meeting_ready: "ok",
  meeting_completed: "neutral",
  qualified: "ok",
  proposal_prep: "neutral",
  proposal_sent: "info",
  negotiation: "info",
  won: "ok",
  lost: "attention",
  paused: "warn",
};

// The columns of the pipeline board: the main path, then the outcomes.
export const BOARD_GROUPS: { id: string; stages: Stage[] }[] = [
  { id: "intake", stages: ["new", "reviewing"] },
  { id: "meeting", stages: ["meeting_booked", "preparing", "meeting_ready", "meeting_completed"] },
  { id: "scope", stages: ["qualified", "proposal_prep", "proposal_sent", "negotiation"] },
  { id: "outcome", stages: ["won", "lost", "paused"] },
];
