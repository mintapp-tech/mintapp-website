import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSqlGateway } from "@/lib/sql-gateway";
import { SESSION_COOKIE, SESSION_IDLE_SECONDS, sessionIdHash, verifySessionToken, type TeamMember } from "./session";

// Every dashboard page and every dashboard server action calls one of these
// before reading or changing anything; layouts and the proxy are not relied on.
// A session counts only if its signed cookie verifies AND its server-side
// record is live (not revoked, not expired, used within the idle limit). If
// that record cannot be checked, access is refused.

export async function currentTeamMember(): Promise<TeamMember | null> {
  const session = verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  try {
    const live = await getSqlGateway().call<boolean>("team_session_touch", {
      p_sid_hash: sessionIdHash(session.sid),
      p_email: session.email,
      p_idle_seconds: SESSION_IDLE_SECONDS,
    });
    return live ? { email: session.email, name: session.name } : null;
  } catch {
    console.error("team_session_check_failed");
    return null;
  }
}

export async function requireTeamMember(): Promise<TeamMember> {
  const member = await currentTeamMember();
  if (!member) redirect("/internal/login");
  return member;
}
