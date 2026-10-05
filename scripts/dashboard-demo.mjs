// LOCAL DEMO of the private admin application, on synthetic data only.
//
// Starts a throwaway PostgreSQL cluster with every migration, seeds synthetic
// inquiries and runs the admin application (APP_SURFACE=admin) with `next dev`
// against it. Supabase data and email settings are overridden with dead local
// values, so the demo cannot reach the real Supabase project or send mail.
// Ctrl+C stops everything and deletes the cluster.
//
//   node scripts/dashboard-demo.mjs [--port 3200] [--auth demo|supabase]
//
//   --auth demo      (default) the custom team login, for this local demo only.
//   --auth supabase  the deployed sign-in path (Supabase Auth with a required
//                    authenticator app and the ADMIN_TEAM allowlist), against a
//                    LOCAL TEST STAND-IN for Supabase Auth
//                    (tests/admin/fake-supabase-auth.mjs), not a real project.
//
//   DASHBOARD_DEMO_PASSWORD may set the demo password (e.g. for tests).

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { startCluster, lit } from "../tests/db/pg-harness.mjs";
import { startFakeAuth } from "../tests/admin/fake-supabase-auth.mjs";
import { hashPassword } from "./lib/team-password.mjs";

const arg = (name, fallback) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : fallback);
const port = Number(arg("--port")) || 3200;
const auth = arg("--auth", "demo");
if (auth !== "demo" && auth !== "supabase") throw new Error("--auth must be demo or supabase");
const password = process.env.DASHBOARD_DEMO_PASSWORD || randomBytes(12).toString("base64url");

const db = await startCluster();
for (const file of db.migrations) db.applyMigration(file);
db.applyLocalDemo();

// SYNTHETIC inquiries. Invented projects and people.
const inquiries = [
  ["11111111-0000-4000-8000-000000000001", "Synthetic Clinic Group", "clinic@example.com", "en", "web_app", "Not sure yet", "Within 3 months", "Egypt",
    "We run three physiotherapy clinics in Cairo. Patients book by phone and we lose track of cancellations. We want an online booking system where patients pick a therapist and time, and our receptionists see the day's schedule. We already use Google Sheets for schedules."],
  ["11111111-0000-4000-8000-000000000002", "مدرسة تجريبية", "school@example.com", "ar", "website", "غير محدد", "خلال شهرين", "مصر",
    "لدينا مدرسة خاصة في الإسكندرية. أولياء الأمور يسألون عن المصروفات والمواعيد عبر الهاتف طوال الوقت. نريد موقعًا يعرض معلومات المدرسة ويتيح التقديم أونلاين."],
  ["11111111-0000-4000-8000-000000000003", "Synthetic Restaurant", "food@example.com", "en", "mobile_app", null, null, null, "An app for my restaurant."],
  ["11111111-0000-4000-8000-000000000004", "منصة حرفيين تجريبية", "crafts@example.com", "ar", "other", null, null, "الأردن",
    "فكرتنا منصة تربط الحرفيين بالعملاء، لكن لسنا متأكدين هل نبدأ بتطبيق أو بموقع. بعض الحرفيين لا يستخدمون الهواتف الذكية."],
];
for (const [id, name, email, lang, type, budget, timeline, country, desc] of inquiries) {
  db.psql(`insert into public.project_inquiries (id, full_name, email, preferred_language, project_type, budget_range, timeline, country, project_description, consent_given, consent_at)
           values (${[id, name, email, lang, type, budget, timeline, country, desc].map(lit).join(", ")}, true, now())`);
}
// One is already booked (through the real booking function).
db.psql(`select public.apply_booking_created('11111111-0000-4000-8000-000000000002', 'demo-seed-booking', now() + interval '4 days', 'Africa/Cairo', now())`);

const team = [
  { email: "omar.demo@mintapp.local", name: "Omar (demo)" },
  { email: "adam.demo@mintapp.local", name: "Adam (demo)" },
];
// Synthetic account that exists in the auth stand-in but is not on the allowlist.
const outsider = "outsider.demo@mintapp.local";

let authEnv;
let fakeAuth;
if (auth === "demo") {
  authEnv = {
    ADMIN_AUTH: "demo",
    TEAM_ACCOUNTS: JSON.stringify(await Promise.all(team.map(async (m) => ({ ...m, passwordHash: await hashPassword(password) })))),
    DASHBOARD_SESSION_SECRET: randomBytes(32).toString("base64url"),
    SUPABASE_URL: "http://127.0.0.1:9",
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

console.log(`\nLocal admin demo (synthetic data only)
  URL:      http://localhost:${port}/login
  Sign-in:  ${auth === "demo" ? "custom demo login (local only)" : `Supabase Auth flow against a LOCAL STAND-IN on port ${fakeAuth.port}, authenticator app required`}
  Accounts: ${team.map((a) => a.email).join(", ")}${auth === "supabase" ? ` (and ${outsider}, not allowlisted)` : ""}
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
