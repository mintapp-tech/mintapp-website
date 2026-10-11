import { ARTIFACT_SCHEMAS, artifactFindings, joinPack, validateArtifact, type ArtifactKind, type DirectionArtifact, type MeetingArtifact, type Pack, type PackContext, type ScopeArtifact } from "./schema";

// Whether the Direction Pack can be shown, and from which versions. Pure.
//
// - "approved": the client presentation and its PDF. Each part's APPROVED version
//   (never a newer draft), each in the current format, passing every check again
//   against the brief, with no placeholder text and with concept screens to draw.
// - "preview": the founders' preview of the LATEST version of each part, in the
//   current format; marked as not approved and never exportable.

export const PACK_PARTS: ArtifactKind[] = ["design", "proposal", "discovery"];

export interface DraftLike {
  artifact?: string;
  version: number;
  review_status: string;
  content: unknown;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
}

export type ReadinessReason = "missing" | "not_approved" | "legacy" | "invalid" | "placeholder" | "hand_design";
export interface Blocker {
  part: ArtifactKind;
  reason: ReadinessReason;
}

export interface DirectionPackSource {
  mode: "approved" | "preview";
  pack: Pack;
  versions: Record<ArtifactKind, number>;
  // Approved mode: when the last of the three was approved, and by whom.
  approvedAt: string | null;
  approvedBy: string[];
  // Approved mode: a part has a newer version than the approved one.
  newerDraft: boolean;
}

export type DirectionPackResult = { ok: true; source: DirectionPackSource } | { ok: false; blockers: Blocker[] };

const latestOf = (drafts: DraftLike[], part: ArtifactKind) => drafts.filter((d) => d.artifact === part).sort((a, b) => b.version - a.version)[0];

export function directionPack(drafts: DraftLike[], ctx: PackContext, mode: "approved" | "preview"): DirectionPackResult {
  const blockers: Blocker[] = [];
  const chosen = {} as Record<ArtifactKind, DraftLike>;
  for (const part of PACK_PARTS) {
    const latest = latestOf(drafts, part);
    const pick = mode === "approved" ? drafts.find((d) => d.artifact === part && d.review_status === "approved") : latest;
    if (!pick) {
      blockers.push({ part, reason: latest ? "not_approved" : "missing" });
      continue;
    }
    if (!ARTIFACT_SCHEMAS[part].safeParse(pick.content).success) {
      blockers.push({ part, reason: "legacy" });
      continue;
    }
    if (mode === "approved") {
      if (!validateArtifact(part, pick.content, ctx).ok) {
        blockers.push({ part, reason: "invalid" });
        continue;
      }
      const findings = artifactFindings(part, pick.content);
      if (findings.some((f) => f.kind === "placeholder")) blockers.push({ part, reason: "placeholder" });
      if (findings.some((f) => f.kind === "hand_design")) blockers.push({ part, reason: "hand_design" });
    }
    chosen[part] = pick;
  }
  if (blockers.length) return { ok: false, blockers };
  const pack = joinPack(chosen.design.content as DirectionArtifact, chosen.proposal.content as ScopeArtifact, chosen.discovery.content as MeetingArtifact);
  const reviewed = PACK_PARTS.map((p) => chosen[p]);
  return {
    ok: true,
    source: {
      mode,
      pack,
      versions: { design: chosen.design.version, proposal: chosen.proposal.version, discovery: chosen.discovery.version },
      approvedAt: mode === "approved" ? (reviewed.map((d) => d.reviewed_at ?? "").sort().at(-1) ?? null) || null : null,
      approvedBy: mode === "approved" ? [...new Set(reviewed.map((d) => d.reviewed_by).filter((x): x is string => !!x))] : [],
      newerDraft: mode === "approved" && PACK_PARTS.some((p) => (latestOf(drafts, p)?.version ?? 0) > chosen[p].version),
    },
  };
}
