// Runs the three admin suites (inquiry dashboard, CRM Release 1, then the sign-in flow,
// both against the local Supabase Auth stand-in), then removes the throwaway
// databases left by the local servers (Playwright force-stops them, skipping their own cleanup).
// Extra arguments go to both Playwright runs.
import { spawnSync } from "node:child_process";
import { sweepOrphanedClusters } from "../tests/db/pg-harness.mjs";

let status = 0;
for (const config of ["playwright.dashboard.config.ts", "playwright.crm.config.ts", "playwright.admin-auth.config.ts"]) {
  const result = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["playwright", "test", "-c", config, ...process.argv.slice(2)], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  await new Promise((r) => setTimeout(r, 1500));
  sweepOrphanedClusters();
  if (result.status !== 0) status = result.status ?? 1;
}
process.exit(status);
