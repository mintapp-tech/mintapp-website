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
//   node scripts/admin-local.mjs [--port 3200]
//
//   DASHBOARD_DEMO_PASSWORD may set the shared password of the synthetic accounts (tests do).

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { startCluster } from "../tests/db/pg-harness.mjs";
import { startFakeAuth } from "../tests/admin/fake-supabase-auth.mjs";

const arg = (name, fallback) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : fallback);
const port = Number(arg("--port")) || 3200;
const password = process.env.DASHBOARD_DEMO_PASSWORD || randomBytes(12).toString("base64url");

const db = await startCluster();
for (const file of db.migrations) db.applyMigration(file);

// SYNTHETIC inquiries: a test fixture, not product data.
db.applyFile(join(process.cwd(), "tests", "fixtures", "synthetic-inquiries.sql"));

// Synthetic sign-ins for the two team members (ids are what ownership stores).
const team = [
  { id: "omar", email: "omar.demo@mintapp.local", name: "Omar" },
  { id: "adam", email: "adam.demo@mintapp.local", name: "Adam" },
];
// Synthetic account that exists in the auth stand-in but is not on the allowlist.
const outsider = "outsider.demo@mintapp.local";

const fakeAuth = await startFakeAuth({ port: Number(arg("--auth-port")) || 0, users: [...team.map((m) => m.email), outsider].map((email) => ({ email, password })) });
const env = {
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

console.log(`
Local admin server (synthetic data only)
  URL:      http://localhost:${port}/login
  Sign-in:  Supabase Auth flow against a LOCAL STAND-IN on port ${fakeAuth.port}, authenticator app required
  Accounts: ${team.map((a) => a.email).join(", ")} (and ${outsider}, not allowlisted)
  Password: ${process.env.ADMIN_LOCAL_PASSWORD ? "(from DASHBOARD_DEMO_PASSWORD)" : password}
  Database: 127.0.0.1:${db.port} (throwaway)
  Stop:     Ctrl+C (the database is deleted)
`);

const next = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["next", "dev", "-p", String(port)], { env, stdio: "inherit", shell: process.platform === "win32" });
const stop = () => {
  next.kill();
  fakeAuth.close();
  db.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
next.on("exit", () => {
  fakeAuth.close();
  db.stop();
  process.exit(0);
});
