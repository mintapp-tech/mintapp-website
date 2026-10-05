import { NextResponse, type NextRequest } from "next/server";
import { supabaseAuthConfig } from "./config";
import { isProtectedAdminPage } from "../surface";
import { ACTIVITY_COOKIE, ACTIVITY_COOKIE_OPTIONS, activityToken, checkActivity } from "./activity";
import { createAuthClient, tokenClaims } from "./supabase-client";

// Runs in the proxy for admin pages when Supabase Auth is in use. Pages
// cannot write cookies, so this is where:
//   - expired access tokens are refreshed (and the new cookies written),
//   - the activity cookie of a fully signed-in session is extended,
//   - a session past the idle or absolute limit is revoked on the auth
//     server and its cookies cleared.
// Authorization itself is decided again by every page and action.

type PendingCookie = { name: string; value: string; options: Record<string, unknown> };

export async function syncAdminSession(request: NextRequest): Promise<NextResponse> {
  const config = supabaseAuthConfig();
  if (!config) return NextResponse.next();
  const pending = new Map<string, PendingCookie>();
  const write = (c: PendingCookie) => {
    request.cookies.set(c.name, c.value);
    pending.set(c.name, c);
  };
  const client = createAuthClient(config, { getAll: () => request.cookies.getAll(), setAll: (list) => list.forEach(write) });
  let ended = false;

  try {
    const {
      data: { session },
    } = await client.auth.getSession(); // refreshes an expired access token
    const { sessionId, aal } = session ? tokenClaims(session.access_token) : { sessionId: null, aal: null };
    if (session && aal === "aal2" && sessionId) {
      const now = Date.now();
      const activity = checkActivity(request.cookies.get(ACTIVITY_COOKIE)?.value, sessionId, config.sessionSecret, now);
      if (activity.ok) {
        write({ name: ACTIVITY_COOKIE, value: activityToken(sessionId, config.sessionSecret, now, activity.startedAt), options: ACTIVITY_COOKIE_OPTIONS });
      } else {
        // Idle, too old, or never recorded: end this session on the auth server.
        await client.auth.signOut({ scope: "local" });
        write({ name: ACTIVITY_COOKIE, value: "", options: { ...ACTIVITY_COOKIE_OPTIONS, maxAge: 0 } });
        ended = true;
      }
    }
  } catch {
    console.error("admin_session_sync_failed");
  }

  const response = ended && isProtectedAdminPage(request.nextUrl.pathname) ? NextResponse.redirect(new URL("/login?expired=1", request.url)) : NextResponse.next({ request });
  for (const c of pending.values()) response.cookies.set(c.name, c.value, c.options);
  return response;
}
