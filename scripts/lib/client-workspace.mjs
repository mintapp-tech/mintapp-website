// The private client workspace for preparing a Pack by hand with Claude Code:
// one folder per lead, OUTSIDE the repository, so nothing in it can be committed.
//
//   <root>/<internal-id>-<client-slug>-<project-slug>/
//     README.md            what the folder is and the rules (points at docs/pack-rules/)
//     source/brief.md      the sanitised brief, pasted from the Pack tab's copied prompt
//     source/assets/       material the client approved for use (never secrets)
//     working/             analysis.json, pack-draft.json while preparing
//     approved/            pack.json once it passes the checker and the founders agree
//     exports/             PDFs saved from the Direction Pack
//     notes/               meeting notes
//
// The internal id is the first 8 characters of the lead's id, never a name; the
// slugs are lowercase ASCII words a founder chooses, never contact details.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

export const DEFAULT_ROOT = process.platform === "win32" ? "C:\\Journey\\Mint\\mintapp-client-work" : join(process.env.HOME ?? ".", "mintapp-client-work");
export const FOLDERS = ["source", "source/assets", "working", "approved", "exports", "notes"];

export function internalId(value) {
  const id = String(value ?? "").trim().toLowerCase();
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$/.test(id)) throw new Error("--id must be the lead's id (a UUID) or its first 8 characters.");
  return id.slice(0, 8);
}

// Lowercase ASCII words joined by hyphens; at most 40 characters. Empty when
// nothing usable is left (for example an Arabic name): the founder then gives one.
export function slug(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

const insideOf = (parent, child) => {
  const r = relative(resolve(parent), resolve(child));
  return r === "" || (!r.startsWith("..") && !isAbsolute(r));
};

export function planWorkspace({ id, client, project, root = DEFAULT_ROOT, repo }) {
  const clientSlug = slug(client);
  const projectSlug = slug(project);
  if (!clientSlug) throw new Error("--client must give an ASCII label for the client (for example the company in Latin letters).");
  if (!projectSlug) throw new Error("--project must give an ASCII label for the project.");
  if (/@|\+?\d{7,}/.test(`${client} ${project}`)) throw new Error("Labels must not contain contact details.");
  if (repo && insideOf(repo, root)) throw new Error("The workspace root is inside the repository. Client work must live outside it.");
  const name = `${internalId(id)}-${clientSlug}-${projectSlug}`;
  return { name, dir: join(root, name), root };
}

export function readme({ name, rulesDir }) {
  return `# ${name}

Private client workspace for preparing a Mintapp Pre-meeting Pack by hand. It lives
outside the repository and must never be committed, synced to a shared drive or
attached to a public issue.

## Before anything else

Read the canonical rules: ${rulesDir}
(README.md, library.md, instructions.md, pack.schema.json). They are generated
from the application's own code and are the only source of truth.

## Steps

1. On the lead's Pre-meeting Pack tab, copy the prompt. Paste only its "Client brief"
   text into \`source/brief.md\` (contact details are already removed).
2. Prepare \`working/pack-draft.json\` following the rules: one JSON object, in the
   brief's language, every client fact quoting the brief.
3. Check it with the application's validator:
   \`npm run pack:check -- "${"<this folder>"}"\` (from the repository).
4. When it passes and both founders agree, copy it to \`approved/pack.json\` and paste it
   on the Pack tab ("Paste Claude's reply"). The application checks it again, and the
   other founder approves each part there.
5. Export the approved Direction Pack to PDF from the presentation into \`exports/\`.

## Never

- Put passwords, API keys or tokens in any file here.
- Add the client's email address, phone number or other contact details to working
  files or the Pack.
- Send real client data to an AI service without the founders' explicit approval.
`;
}

export const BRIEF_TEMPLATE = `<!-- Paste below ONLY the "Client brief" text from the Pack tab's copied prompt
     (it starts with "Project type:" or "Project description:"). Contact details are
     already removed; do not add any. This comment is ignored by the checker. -->
`;

export function createWorkspace(plan, { rulesDir, now = new Date() } = {}) {
  if (existsSync(plan.dir)) throw new Error(`${plan.dir} already exists. Nothing was changed.`);
  for (const f of FOLDERS) mkdirSync(join(plan.dir, f), { recursive: true });
  writeFileSync(join(plan.dir, "README.md"), readme({ name: plan.name, rulesDir }));
  writeFileSync(join(plan.dir, "source", "brief.md"), BRIEF_TEMPLATE);
  writeFileSync(join(plan.dir, ".workspace.json"), `${JSON.stringify({ name: plan.name, created_at: now.toISOString(), rules: rulesDir }, null, 2)}\n`);
  return plan.dir;
}
