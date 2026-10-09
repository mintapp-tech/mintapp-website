// Which application a deployment serves, and on which hosts.
//
// One codebase, two Vercel projects: the public site (APP_SURFACE unset) and
// the private admin application (APP_SURFACE=admin). Admin routes are built
// only into the admin project (see pageExtensions in next.config.ts), and the
// admin project answers only on its configured hosts.

export type Surface = "public" | "admin";
type Env = Record<string, string | undefined>;

export const appSurface = (env: Env = process.env): Surface => (env.APP_SURFACE === "admin" ? "admin" : "public");

const normalizeHost = (host: string) => host.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");

// ADMIN_HOSTS lists the hostnames the admin application answers on (for
// example the chosen admin subdomain). A Vercel Preview of the admin project
// also answers on its own generated preview hostnames, and local development
// on localhost. Production answers only on ADMIN_HOSTS: with none configured
// it answers nowhere.
export function adminHosts(env: Env = process.env): string[] {
  const hosts = (env.ADMIN_HOSTS ?? "").split(",").map(normalizeHost).filter(Boolean);
  if (env.VERCEL_ENV === "preview") {
    for (const host of [env.VERCEL_URL, env.VERCEL_BRANCH_URL]) if (host) hosts.push(normalizeHost(host));
  }
  if (env.NODE_ENV !== "production") hosts.push("localhost", "127.0.0.1");
  return [...new Set(hosts)];
}

export const isAdminHost = (host: string | null | undefined, env: Env = process.env) => !!host && adminHosts(env).includes(normalizeHost(host));

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const ADMIN_PAGES = new RegExp(`^/(login|login/mfa|inquiries|inquiries/${UUID})/?$`, "i");

export const isAdminPage = (pathname: string) => ADMIN_PAGES.test(pathname);
export const isProtectedAdminPage = (pathname: string) => /^\/inquiries(\/|$)/.test(pathname);
