// Typechecks every commit between a base and HEAD, each in a temporary
// worktree, so a branch never contains a commit that does not build on its
// own (bisecting and checking out old commits depend on that).
//
//   npm run check:commits            (base: origin/main)
//   npm run check:commits -- <base>

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Already-published commits that are known not to build on their own. They
// cannot be fixed without rewriting pushed history; their successors build.
const KNOWN_BROKEN = {
  "49082616d5c6796cb3e95b0c4b6cebca78704849":
    "deletes src/lib/preparation/supabase-store.ts while run.ts still imports it until bbeeda3",
};

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const base = process.argv[2] ?? "origin/main";
const commits = git("rev-list", "--reverse", `${base}..HEAD`).split("\n").filter(Boolean);
if (commits.length === 0) {
  console.log(`No commits between ${base} and HEAD.`);
  process.exit(0);
}

const root = git("rev-parse", "--show-toplevel");
const dir = mkdtempSync(join(tmpdir(), "check-commits-"));
const tree = join(dir, "tree");
git("worktree", "add", "--detach", "--quiet", tree, commits[0]);
symlinkSync(resolve(root, "node_modules"), join(tree, "node_modules"), "junction");

let failures = 0;
try {
  for (const sha of commits) {
    git("-C", tree, "checkout", "--quiet", "--detach", sha);
    const result = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["tsc", "--noEmit", "-p", "."], { cwd: tree, encoding: "utf8", shell: process.platform === "win32" });
    const subject = git("log", "-1", "--format=%h %s", sha);
    if (result.status === 0) console.log(`ok     ${subject}`);
    else if (KNOWN_BROKEN[sha]) console.log(`known  ${subject}\n       (${KNOWN_BROKEN[sha]})`);
    else {
      failures++;
      console.log(`FAIL   ${subject}\n${result.stdout.split("\n").slice(0, 10).join("\n")}`);
    }
  }
} finally {
  // Remove only the link first: removing the worktree with the link still in
  // place could delete the real node_modules through it.
  unlinkSync(join(tree, "node_modules"));
  git("worktree", "remove", "--force", tree);
  rmSync(dir, { recursive: true, force: true });
}
process.exit(failures ? 1 : 0);
