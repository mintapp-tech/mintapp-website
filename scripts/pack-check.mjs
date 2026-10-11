// Checks a manual Pack with the application's own validator before it is imported:
//
//   npm run pack:check -- <workspace folder>            checks working/pack-draft.json
//   npm run pack:check -- <workspace folder> --approved checks approved/pack.json
//
// The brief is the workspace's source/brief.md. Prints problem kinds only, never the
// Pack's content; exits non-zero when anything must be fixed.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const folder = process.argv[2];
if (!folder) {
  console.error("Usage: npm run pack:check -- <workspace folder> [--approved]");
  process.exit(1);
}
const dir = resolve(folder);
const pack = join(dir, process.argv.includes("--approved") ? "approved/pack.json" : "working/pack-draft.json");
const brief = join(dir, "source", "brief.md");
for (const f of [pack, brief]) {
  if (!existsSync(f)) {
    console.error(`Missing ${f}`);
    process.exit(1);
  }
}
const result = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["vitest", "run", "src/lib/pack/check-file.test.ts"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, PACK_FILE: pack, PACK_BRIEF: brief },
});
process.exit(result.status ?? 1);
