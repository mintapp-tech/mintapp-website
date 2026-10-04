// Runs the dashboard suite, then removes the throwaway database left by the
// demo server (Playwright force-stops it, skipping its own cleanup).
import { spawnSync } from "node:child_process";
import { sweepOrphanedClusters } from "../tests/db/pg-harness.mjs";

const result = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["playwright", "test", "-c", "playwright.dashboard.config.ts", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
await new Promise((r) => setTimeout(r, 1500));
sweepOrphanedClusters();
process.exit(result.status ?? 1);
