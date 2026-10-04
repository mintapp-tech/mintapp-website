import { z } from "zod";

// Mintapp team accounts allowed into the private dashboard, from the
// server-only TEAM_ACCOUNTS variable (JSON). Passwords are stored only as
// scrypt hashes made with scripts/team-password-hash.mjs.
//
//   TEAM_ACCOUNTS=[{"email":"omar@…","name":"Omar","passwordHash":"scrypt$…"}]
//
// Missing or invalid configuration means no accounts: the dashboard stays closed.

export interface TeamAccount {
  email: string;
  name: string;
  passwordHash: string;
}

const accountSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  name: z.string().trim().min(1).max(80),
  passwordHash: z.string().regex(/^scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9_-]{16,}\$[A-Za-z0-9_-]{60,}$/),
});

export function teamAccounts(env: Record<string, string | undefined> = process.env): TeamAccount[] {
  const raw = env.TEAM_ACCOUNTS;
  if (!raw) return [];
  try {
    const parsed = z.array(accountSchema).min(1).max(10).safeParse(JSON.parse(raw));
    if (!parsed.success) return [];
    const emails = parsed.data.map((a) => a.email);
    return new Set(emails).size === emails.length ? parsed.data : [];
  } catch {
    return [];
  }
}

export function sessionSecret(env: Record<string, string | undefined> = process.env): string | null {
  const secret = env.DASHBOARD_SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

export const dashboardConfigured = (env: Record<string, string | undefined> = process.env) => teamAccounts(env).length > 0 && sessionSecret(env) !== null;
