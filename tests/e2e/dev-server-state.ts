import { readdirSync, readFileSync, statSync, type Dirent } from "node:fs";
import path from "node:path";

// Helpers for the browser suite's start-up warm-up and its end-of-run health
// check (global-setup.ts, global-teardown.ts). Kept free of Playwright imports
// so they can be unit tested (dev-server-state.unit.ts).
//
// Why they exist (issue #75): Next's dev server rewrites
// .next/dev/prerender-manifest.json, with no lock, the first time each
// dynamic page pattern is requested. Parallel workers reaching un-warmed pages
// at once interleave those writes; the file ends up truncated or with stray
// trailing text, and every later request answers 500 until it is regenerated.
// The suite therefore requests every page once, in sequence, before any worker
// starts, and checks that the manifests are readable before and after the run.

const PAGE_FILE = /^page\.(tsx|ts|jsx|js)$/;

/**
 * Every public page under src/app/[locale], as a concrete path for each
 * locale, in a stable order. Derived from the file system so a new page is
 * warmed without anyone remembering to list it. A page with a dynamic segment
 * cannot be requested without a value, so it fails loudly instead of being
 * skipped (a skipped page is exactly the gap this warm-up exists to close).
 */
export function localePageRoutes(appDir: string, locales: readonly string[]): string[] {
  const localeDir = path.join(appDir, "[locale]");
  const relativeRoutes: string[] = [];

  const walk = (dir: string, segments: string[]) => {
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    if (entries.some((entry) => entry.isFile() && PAGE_FILE.test(entry.name))) {
      relativeRoutes.push(segments.length ? `/${segments.join("/")}` : "");
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (isIgnoredFolder(entry)) continue;
      if (/^\[.*\]$/.test(entry.name)) {
        throw new Error(
          `${path.join(dir, entry.name)} is a dynamic segment. The browser suite's warm-up cannot request it without a value; ` +
            `add an explicit warm-up path in tests/e2e/global-setup.ts and teach localePageRoutes about it.`,
        );
      }
      // A route group, such as (marketing), is not part of the address.
      const isGroup = /^\(.*\)$/.test(entry.name);
      walk(path.join(dir, entry.name), isGroup ? segments : [...segments, entry.name]);
    }
  };
  walk(localeDir, []);

  // Locale root first for each locale, then its pages, so the order is stable and readable in logs.
  return locales.flatMap((locale) => relativeRoutes.map((route) => `/${locale}${route}`));
}

function isIgnoredFolder(entry: Dirent): boolean {
  // Next treats _folders as private and @folders as parallel-route slots: neither is an address.
  return entry.name.startsWith("_") || entry.name.startsWith("@");
}

export interface UnreadableManifest {
  file: string;
  reason: string;
}

/** Generated JSON manifests in the dev server's output folder that cannot be read and parsed. */
export function findUnreadableManifests(distDir: string): UnreadableManifest[] {
  let names: string[];
  try {
    if (!statSync(distDir).isDirectory()) return [{ file: distDir, reason: "is not a directory" }];
    names = readdirSync(distDir).filter((name) => name.endsWith("manifest.json")).sort();
  } catch (error) {
    return [{ file: distDir, reason: `cannot be read: ${(error as Error).message}` }];
  }
  if (!names.includes("prerender-manifest.json")) {
    return [{ file: path.join(distDir, "prerender-manifest.json"), reason: "does not exist" }];
  }
  const problems: UnreadableManifest[] = [];
  for (const name of names) {
    const file = path.join(distDir, name);
    try {
      JSON.parse(readFileSync(file, "utf8"));
    } catch (error) {
      problems.push({ file, reason: (error as Error).message });
    }
  }
  return problems;
}

/** Throws a plain-language error when any generated manifest is unreadable; returns quietly otherwise. */
export function assertManifestsReadable(distDir: string, when: string): void {
  const problems = findUnreadableManifests(distDir);
  if (problems.length === 0) return;
  throw new Error(
    `The dev server's generated files are corrupted ${when}, so this run's results cannot be trusted ` +
      `(a failure here is not a product failure; see issue #75). Delete the .next folder and run the suite again.\n` +
      problems.map((problem) => `  - ${problem.file}: ${problem.reason}`).join("\n"),
  );
}

/** Where `next dev` writes its generated manifests, relative to the folder holding playwright.config.ts. */
export function devDistDir(projectRoot: string): string {
  return path.join(projectRoot, ".next", "dev");
}
