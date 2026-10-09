import { ownersLabel, type TeamMember } from "./auth/config";

// Names for the team as people read them. Records keep a member's id (owners,
// responsible person) or sign-in email (who did something); the interface shows
// the name. A former member's email shows its local part only.
export function people(members: readonly TeamMember[]) {
  return {
    ofEmail: (email: string | null | undefined) => (email ? (members.find((m) => m.email === email)?.name ?? (email.includes("@") ? email.split("@")[0] : email)) : ""),
    ofId: (id: string) => ownersLabel([id], members, id),
    ofIds: (ids: readonly string[], none: string) => ownersLabel(ids, members, none),
  };
}
