// Runs the admin sign-in tests against REAL Supabase Auth in the isolated
// synthetic review project. Settings come from .env.review.local (git-ignored):
//   REVIEW_SUPABASE_URL, REVIEW_SUPABASE_PUBLISHABLE_KEY, REVIEW_SUPABASE_SECRET_KEY
// The review project must already have supabase/review/01_review_marker.sql.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { sweepOrphanedClusters } from "../tests/db/pg-harness.mjs";
import { assertReviewProject, reviewProjectFromEnv } from "./lib/review-auth.mjs";

await assertReviewProject(reviewProjectFromEnv());
const result = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["playwright", "test", "-c", "playwright.admin-auth.config.ts", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: process.platform === "win32",
  // A fresh random password each run, for accounts recreated each run.
  env: { ...process.env, ADMIN_AUTH_LIVE: "1", DASHBOARD_DEMO_PASSWORD: `Rv-${randomBytes(18).toString("base64url")}-9a` },
});
await new Promise((r) => setTimeout(r, 1500));
sweepOrphanedClusters();
process.exit(result.status ?? 1);
