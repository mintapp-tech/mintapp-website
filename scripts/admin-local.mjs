// LOCAL admin server for development and the browser tests, on synthetic data only.
//
// Starts a throwaway PostgreSQL cluster with every migration, loads the synthetic
// fixture (tests/fixtures/synthetic-inquiries.sql) and runs the admin application
// (APP_SURFACE=admin) with `next dev` against it. Sign-in is the real deployed path
// (Supabase Auth with a required authenticator app and the ADMIN_TEAM allowlist),
// against a LOCAL TEST STAND-IN for Supabase Auth (tests/admin/fake-supabase-auth.mjs),
// not a real project. Supabase data and email settings are overridden with dead
// local values, so it cannot reach the real Supabase project or send mail.
// Ctrl+C stops everything and deletes the cluster.
//
//   node scripts/admin-local.mjs [--port 3200] [--live]
//
//   --live  runs the same server against the REAL Supabase Auth and database of the
//           isolated synthetic review project (REVIEW_SUPABASE_* from .env.review.local,
//           never the live project): no local database, no stand-in. It first checks the
//           project answers review_environment() = 'synthetic-review', and recreates only
//           the three synthetic *.review@example.com test accounts. It behaves like the
//           admin Preview: VERCEL_ENV=preview, so the review guard is active.
//
//   DASHBOARD_DEMO_PASSWORD may set the shared password of the synthetic accounts (tests do).

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { startCluster } from "../tests/db/pg-harness.mjs";
import { startFakeAuth } from "../tests/admin/fake-supabase-auth.mjs";
import { REVIEW_ACCOUNTS, assertReviewProject, resetReviewAccounts, reviewProjectFromEnv } from "./lib/review-auth.mjs";

const arg = (name, fallback) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : fallback);
const port = Number(arg("--port")) || 3200;
const password = process.env.DASHBOARD_DEMO_PASSWORD || randomBytes(12).toString("base64url");

const live = process.argv.includes("--live");

// Synthetic sign-ins for the two team members (ids are what ownership stores).
const team = live
  ? [
      { id: "omar", email: REVIEW_ACCOUNTS.omar.email, name: "Omar" },
      { id: "adam", email: REVIEW_ACCOUNTS.adam.email, name: "Adam" },
    ]
  : [
      { id: "omar", email: "omar.demo@mintapp.local", name: "Omar" },
      { id: "adam", email: "adam.demo@mintapp.local", name: "Adam" },
    ];
// Synthetic account that exists in the auth service but is not on the allowlist.
const outsider = live ? REVIEW_ACCOUNTS.outsider.email : "outsider.demo@mintapp.local";

let db = null;
let fakeAuth = null;
let env;
let where;
if (live) {
  const project = reviewProjectFromEnv();
  await assertReviewProject(project);
  await resetReviewAccounts(project, password);
  env = {
    ...process.env,
    APP_SURFACE: "admin",
    VERCEL_ENV: "preview", // the review guard is active, as on the admin Preview
    PREPARATION_GENERATOR: "off",
    // Everything points at the review project; nothing can send mail.
    SUPABASE_URL: project.url,
    SUPABASE_PUBLISHABLE_KEY: project.publishableKey,
    SUPABASE_SECRET_KEY: project.secretKey,
    RESEND_API_KEY: "",
    EMAIL_SENDING_MODE: "disabled",
    ADMIN_TEAM: JSON.stringify(team),
    ADMIN_SESSION_SECRET: randomBytes(32).toString("base64url"),
  };
  delete env.DASHBOARD_LOCAL_PG_PORT;
  delete env.DASHBOARD_DEMO;
  where = `REAL Supabase (synthetic review project ${new URL(project.url).host})`;
} else {
  db = await startCluster();
  for (const file of db.migrations) db.applyMigration(file);
  // SYNTHETIC inquiries: a test fixture, not product data.
  db.applyFile(join(process.cwd(), "tests", "fixtures", "synthetic-inquiries.sql"));
  fakeAuth = await startFakeAuth({ port: Number(arg("--auth-port")) || 0, users: [...team.map((m) => m.email), outsider].map((email) => ({ email, password })) });
  env = {
    ...process.env,
    APP_SURFACE: "admin",
    // Local PostgreSQL instead of Supabase for the server-side data functions (never honoured when NODE_ENV is production).
    DASHBOARD_DEMO: "1",
    DASHBOARD_LOCAL_PG_PORT: String(db.port),
    PREPARATION_GENERATOR: process.env.PREPARATION_GENERATOR ?? "off",
    // Dead values: nothing here can reach the real project or send mail.
    SUPABASE_SECRET_KEY: "local-not-a-key",
    RESEND_API_KEY: "",
    EMAIL_SENDING_MODE: "disabled",
    SUPABASE_URL: `http://127.0.0.1:${fakeAuth.port}`,
    SUPABASE_PUBLISHABLE_KEY: "local-stand-in-publishable-key",
    ADMIN_TEAM: JSON.stringify(team),
    ADMIN_SESSION_SECRET: randomBytes(32).toString("base64url"),
  };
  where = `LOCAL STAND-IN on port ${fakeAuth.port}`;
}

console.log(`
Local admin server (${live ? "synthetic review project" : "synthetic data only"})
  URL:      http://localhost:${port}/login
  Sign-in:  Supabase Auth flow against ${where}, authenticator app required
  Accounts: ${team.map((a) => a.email).join(", ")} (and ${outsider}, not allowlisted)
  Password: ${process.env.DASHBOARD_DEMO_PASSWORD ? "(from DASHBOARD_DEMO_PASSWORD)" : password}
  Database: ${live ? "the review project's own" : `127.0.0.1:${db.port} (throwaway)`}
  Stop:     Ctrl+C${live ? "" : " (the database is deleted)"}
`);

const next = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["next", "dev", "-p", String(port)], { env, stdio: "inherit", shell: process.platform === "win32" });
const stop = () => {
  next.kill();
  fakeAuth?.close();
  db?.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
next.on("exit", () => {
  fakeAuth?.close();
  db?.stop();
  process.exit(0);
});
