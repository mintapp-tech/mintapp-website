// Starts a private client workspace for a manual Pack, outside the repository:
//
//   npm run pack:workspace -- --id <lead id> --client <label> --project <label> [--root <folder>] [--dry-run]
//
// Example (an invented lead):
//   npm run pack:workspace -- --id 1f2e3d4c --client "cedar physio" --project "booking system" --dry-run
//
// The root defaults to C:\Journey\Mint\mintapp-client-work (or MINTAPP_CLIENT_WORK).
// It refuses a root inside the repository, an existing folder, labels without
// ASCII letters, and labels that look like contact details. See docs/pack-rules/README.md.

import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_ROOT, createWorkspace, planWorkspace } from "./lib/client-workspace.mjs";

const repo = resolve(fileURLToPath(new URL("..", import.meta.url)));
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

try {
  const plan = planWorkspace({ id: arg("--id"), client: arg("--client"), project: arg("--project"), root: arg("--root") ?? process.env.MINTAPP_CLIENT_WORK ?? DEFAULT_ROOT, repo });
  const rulesDir = join(repo, "docs", "pack-rules");
  if (process.argv.includes("--dry-run")) {
    console.log(`Would create ${plan.dir}`);
  } else {
    console.log(`Created ${createWorkspace(plan, { rulesDir })}`);
    console.log(`Next: read ${rulesDir}, then paste the brief into source/brief.md.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
