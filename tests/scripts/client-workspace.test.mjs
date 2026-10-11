// The private client-workspace convention for manual Packs.
//   npm run test:scripts
// Uses a throwaway folder in the system temp directory; never the real root.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BRIEF_TEMPLATE, FOLDERS, createWorkspace, internalId, planWorkspace, slug } from "../../scripts/lib/client-workspace.mjs";

const repo = process.cwd();
const ID = "1f2e3d4c-0000-4000-8000-000000000001";

test("the folder name is an internal id and two sanitised labels, never a name or contact detail", () => {
  assert.equal(internalId(ID), "1f2e3d4c");
  assert.equal(internalId("1F2E3D4C"), "1f2e3d4c");
  assert.throws(() => internalId("Cedar Physio"));
  assert.equal(slug("Cédar Physio & Co."), "cedar-physio-co");
  assert.equal(slug("عيادة الأرز"), "");
  const root = mkdtempSync(join(tmpdir(), "mintapp-ws-"));
  try {
    assert.equal(planWorkspace({ id: ID, client: "Cedar Physio", project: "Booking system", root, repo }).name, "1f2e3d4c-cedar-physio-booking-system");
    assert.throws(() => planWorkspace({ id: ID, client: "عيادة", project: "x", root, repo }), /ASCII/);
    assert.throws(() => planWorkspace({ id: ID, client: "layla@cedar.example", project: "x", root, repo }), /contact details/);
    assert.throws(() => planWorkspace({ id: ID, client: "cedar", project: "call 01005550199", root, repo }), /contact details/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a workspace inside the repository is refused, so client work can never be committed", () => {
  assert.throws(() => planWorkspace({ id: ID, client: "cedar", project: "booking", root: join(repo, "client-work"), repo }), /inside the repository/);
  assert.throws(() => planWorkspace({ id: ID, client: "cedar", project: "booking", root: repo, repo }), /inside the repository/);
});

test("creates the agreed folders and templates, and never overwrites an existing workspace", () => {
  const root = mkdtempSync(join(tmpdir(), "mintapp-ws-"));
  try {
    const plan = planWorkspace({ id: ID, client: "cedar", project: "booking", root, repo });
    const dir = createWorkspace(plan, { rulesDir: join(repo, "docs", "pack-rules"), now: new Date("2026-10-11T00:00:00Z") });
    for (const f of FOLDERS) assert.ok(existsSync(join(dir, f)), f);
    assert.equal(readFileSync(join(dir, "source", "brief.md"), "utf8"), BRIEF_TEMPLATE);
    const readme = readFileSync(join(dir, "README.md"), "utf8");
    assert.match(readme, /pack-rules/);
    assert.match(readme, /never be committed/);
    assert.doesNotMatch(readme, /sk-|api[_-]?key\s*=|password\s*=/i);
    assert.throws(() => createWorkspace(plan, { rulesDir: "x" }), /already exists/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the repository ignores any client-work folder that ends up inside it by mistake", () => {
  assert.match(readFileSync(join(repo, ".gitignore"), "utf8"), /^mintapp-client-work\/$/m);
});
