import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken, type TeamMember } from "./session";

// Every dashboard page and every dashboard server action calls one of these
// before reading or changing anything. Not relying on layouts or the proxy.

export async function currentTeamMember(): Promise<TeamMember | null> {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function requireTeamMember(): Promise<TeamMember> {
  const member = await currentTeamMember();
  if (!member) redirect("/internal/login");
  return member;
}
