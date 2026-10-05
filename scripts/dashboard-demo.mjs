// LOCAL DEMO of the private admin application, on synthetic data only.
//
// Starts a throwaway PostgreSQL cluster with every migration, seeds synthetic
// inquiries and runs the admin application (APP_SURFACE=admin) with `next dev`
// against it. Supabase data and email settings are overridden with dead local
// values, so the demo cannot reach the real Supabase project or send mail.
// Ctrl+C stops everything and deletes the cluster.
//
//   node scripts/dashboard-demo.mjs [--port 3200] [--auth demo|supabase|supabase-live]
//
//   --auth demo      (default) the custom team login, for this local demo only.
//   --auth supabase  the deployed sign-in path (Supabase Auth with a required
//                    authenticator app and the ADMIN_TEAM allowlist), against a
//                    LOCAL TEST STAND-IN for Supabase Auth
//                    (tests/admin/fake-supabase-auth.mjs), not a real project.
//   --auth supabase-live  the same sign-in path against REAL Supabase Auth in the
//                    isolated synthetic review project (REVIEW_SUPABASE_*; see
//                    scripts/lib/review-auth.mjs). Its synthetic review
//                    accounts are recreated on start. Data stays local.
//
//   DASHBOARD_DEMO_PASSWORD may set the demo password (e.g. for tests).

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { startCluster } from "../tests/db/pg-harness.mjs";
import { startFakeAuth } from "../tests/admin/fake-supabase-auth.mjs";
import { hashPassword } from "./lib/team-password.mjs";
import { REVIEW_ACCOUNTS, assertReviewProject, resetReviewAccounts, reviewProjectFromEnv } from "./lib/review-auth.mjs";

const arg = (name, fallback) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : fallback);
const port = Number(arg("--port")) || 3200;
const auth = arg("--auth", "demo");
if (!["demo", "supabase", "supabase-live"].includes(auth)) throw new Error("--auth must be demo, supabase or supabase-live");
if (auth === "supabase-live" && !process.env.DASHBOARD_DEMO_PASSWORD) throw new Error("--auth supabase-live needs DASHBOARD_DEMO_PASSWORD for the synthetic review accounts");
const password = process.env.DASHBOARD_DEMO_PASSWORD || randomBytes(12).toString("base64url");

const db = await startCluster();
for (const file of db.migrations) db.applyMigration(file);
db.applyLocalDemo();

// SYNTHETIC inquiries (the same seed as the isolated review project).
db.applyFile(join(process.cwd(), "supabase", "review", "02_synthetic_inquiries.sql"));

// Synthetic sign-ins for the two team members (ids are what ownership stores).
const live = auth === "supabase-live";
const team = live
  ? [
      { id: "omar", ...REVIEW_ACCOUNTS.omar },
      { id: "adam", ...REVIEW_ACCOUNTS.adam },
    ]
  : [
      { id: "omar", email: "omar.demo@mintapp.local", name: "Omar" },
      { id: "adam", email: "adam.demo@mintapp.local", name: "Adam" },
    ];
// Synthetic account that exists in the auth service but is not on the allowlist.
const outsider = live ? REVIEW_ACCOUNTS.outsider.email : "outsider.demo@mintapp.local";

let authEnv;
let fakeAuth;
if (auth === "demo") {
  authEnv = {
    ADMIN_AUTH: "demo",
    TEAM_ACCOUNTS: JSON.stringify(await Promise.all(team.map(async ({ email, name }) => ({ email, name, passwordHash: await hashPassword(password) })))),
    DASHBOARD_SESSION_SECRET: randomBytes(32).toString("base64url"),
    SUPABASE_URL: "http://127.0.0.1:9",
  };
} else if (live) {
  const project = reviewProjectFromEnv();
  await assertReviewProject(project);
  await resetReviewAccounts(project, password);
  authEnv = {
    SUPABASE_URL: project.url,
    SUPABASE_PUBLISHABLE_KEY: project.publishableKey,
    ADMIN_TEAM: JSON.stringify(team),
    ADMIN_SESSION_SECRET: randomBytes(32).toString("base64url"),
  };
} else {
  fakeAuth = await startFakeAuth({ port: Number(arg("--auth-port")) || 0, users: [...team.map((m) => m.email), outsider].map((email) => ({ email, password })) });
  authEnv = {
    SUPABASE_URL: `http://127.0.0.1:${fakeAuth.port}`,
    SUPABASE_PUBLISHABLE_KEY: "local-stand-in-publishable-key",
    ADMIN_TEAM: JSON.stringify(team),
    ADMIN_SESSION_SECRET: randomBytes(32).toString("base64url"),
  };
}

const env = {
  ...process.env,
  APP_SURFACE: "admin",
  DASHBOARD_DEMO: "1",
  DASHBOARD_LOCAL_PG_PORT: String(db.port),
  PREPARATION_GENERATOR: process.env.PREPARATION_GENERATOR ?? "off",
  // Dead values: nothing in the demo can reach the real project or send mail.
  SUPABASE_SECRET_KEY: "demo-not-a-key",
  RESEND_API_KEY: "",
  EMAIL_SENDING_MODE: "disabled",
  ...authEnv,
};
// The review project's service key is only needed above, never by the app.
delete env.REVIEW_SUPABASE_SECRET_KEY;

console.log(`\nLocal admin demo (synthetic data only)
  URL:      http://localhost:${port}/login
  Sign-in:  ${auth === "demo" ? "custom demo login (local only)" : live ? "REAL Supabase Auth in the synthetic review project, authenticator app required" : `Supabase Auth flow against a LOCAL STAND-IN on port ${fakeAuth.port}, authenticator app required`}
  Accounts: ${team.map((a) => a.email).join(", ")}${auth !== "demo" ? ` (and ${outsider}, not allowlisted)` : ""}
  Password: ${process.env.DASHBOARD_DEMO_PASSWORD ? "(from DASHBOARD_DEMO_PASSWORD)" : password}
  Database: 127.0.0.1:${db.port} (throwaway)
  Stop:     Ctrl+C (the database is deleted)\n`);

const next = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["next", "dev", "-p", String(port)], { env, stdio: "inherit", shell: process.platform === "win32" });
const stop = () => {
  next.kill();
  fakeAuth?.close();
  db.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
next.on("exit", () => {
  fakeAuth?.close();
  db.stop();
  process.exit(0);
});
