// Removes the operational test data from the SYNTHETIC review project (mintapp-review) and
// nothing else. A dry run by default.
//
//   npm run review:clean                 dry run: checks and counts, changes nothing
//   npm run review:clean -- --apply      removes what the dry run listed
//
// It loads only .env.review.local (REVIEW_SUPABASE_*), refuses unless the project answers
// review_environment() = 'synthetic-review', and never prints a key, an address, the project
// address or the content of any row. Supabase Auth (reviewer accounts and authenticators),
// settings and automation configuration are not touched. Needs supabase/review/review_clean.sql
// installed once (see supabase/review/README.md); the dry run does not.

import { adminClient, reviewProjectFromEnv } from "./lib/review-auth.mjs";
import { CleanError, GateError, cleanReview, supabaseExecutor } from "./lib/review-clean.mjs";

const args = process.argv.slice(2);
const unknown = args.filter((a) => a !== "--apply" && a !== "--dry-run");
if (unknown.length || (args.includes("--apply") && args.includes("--dry-run"))) {
  console.error("Usage: npm run review:clean [-- --apply]   (no flag, or --dry-run, only checks and counts)");
  process.exit(2);
}

try {
  const project = reviewProjectFromEnv(); // refuses the project named by SUPABASE_URL
  const result = await cleanReview(supabaseExecutor(project, adminClient(project)), {
    apply: args.includes("--apply"),
    log: (line) => console.log(line),
  });
  process.exit(result.applied && !result.clean ? 1 : 0);
} catch (err) {
  // Only messages written by this tool, or a short reason. Never a connection detail or a row.
  console.error(err instanceof GateError || err instanceof CleanError ? err.message : `Could not clean: ${err?.message ?? "unknown error"}`);
  process.exit(1);
}
