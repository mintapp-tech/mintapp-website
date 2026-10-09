// Runs the admin application's sign-in suite and CRM suite against the isolated synthetic review
// project (REVIEW_SUPABASE_* in .env.review.local). Refuses unless the project answers
// review_environment() = 'synthetic-review' and is not the project named by SUPABASE_URL.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { assertReviewProject, reviewProjectFromEnv } from "./lib/review-auth.mjs";

await assertReviewProject(reviewProjectFromEnv());
let status = 0;
for (const suite of (process.env.REVIEW_SUITES ?? "auth,crm").split(",")) {
  const result = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["playwright", "test", "-c", "playwright.review-live.config.ts", ...process.argv.slice(2)], {
    stdio: "inherit",
    shell: process.platform === "win32",
    // A fresh random password for each run; the synthetic accounts are recreated each time.
    env: { ...process.env, REVIEW_SUITE: suite, ADMIN_AUTH_LIVE: "1", DASHBOARD_DEMO_PASSWORD: `Rv-${randomBytes(18).toString("base64url")}-9a` },
  });
  if (result.status !== 0) status = result.status ?? 1;
}
process.exit(status);
