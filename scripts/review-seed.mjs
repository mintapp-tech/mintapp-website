// Regenerates supabase/review/seed_curated.sql from src/lib/review-seed/data.ts:
//   npm run review:seed
// It only writes the file. Loading it into the review project is the owner's step
// (see supabase/review/README.md).
import { spawnSync } from "node:child_process";

const result = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["vitest", "run", "src/lib/review-seed/seed.test.ts"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, UPDATE_REVIEW_SEED: "1" },
});
process.exit(result.status ?? 1);
