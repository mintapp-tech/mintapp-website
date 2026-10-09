// Cross-site request protection for the admin routes that are not server
// actions (Next.js already checks Origin against Host for actions). Session
// cookies are SameSite=Strict as well, so this is a second, independent layer.

const first = (value: string | null) => value?.split(",")[0]?.trim().toLowerCase() ?? "";

// A state-changing request is accepted only when it names its own origin, that
// origin is this host, and the browser did not mark it as coming from another site.
export function isSameOrigin(headers: Headers): boolean {
  const origin = headers.get("origin");
  if (!origin) return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }
  const hosts = [first(headers.get("host")), first(headers.get("x-forwarded-host"))].filter(Boolean);
  if (!hosts.includes(originHost)) return false;
  const site = headers.get("sec-fetch-site");
  return !site || site === "same-origin";
}
