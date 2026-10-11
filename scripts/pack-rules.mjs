// Regenerates docs/pack-rules/ (the rules Claude reads for manual preparation)
// from src/lib/pack. Run after changing the library or the Pack schema:
//   npm run pack:rules
import { spawnSync } from "node:child_process";

const result = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["vitest", "run", "src/lib/pack/rules.test.ts"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, UPDATE_PACK_RULES: "1" },
});
process.exit(result.status ?? 1);
