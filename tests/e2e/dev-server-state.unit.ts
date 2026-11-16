import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PUBLIC_ROUTE_PATHS } from "../../src/lib/seo";
import { SUPPORTED_LOCALES } from "../../src/lib/locales";
import { assertManifestsReadable, findUnreadableManifests, localePageRoutes } from "./dev-server-state";

// Unit tests for the browser suite's warm-up and health-check helpers (issue #75).
// Everything happens in a temporary folder with a space in its name (the usual
// Windows case): no real checkout and no real .next output is ever touched.

let root: string;
beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), "dev server state "));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function write(relative: string, content = "") {
  const file = path.join(root, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

describe("localePageRoutes", () => {
  it("lists every page under [locale] for every locale, locale root first", () => {
    write("[locale]/page.tsx");
    write("[locale]/about/page.tsx");
    write("[locale]/work/rentop/page.tsx");
    expect(localePageRoutes(root, ["en", "ar"])).toEqual(["/en", "/en/about", "/en/work/rentop", "/ar", "/ar/about", "/ar/work/rentop"]);
  });

  it("ignores folders that are not addresses and pages outside [locale]", () => {
    write("[locale]/page.tsx");
    write("[locale]/_private/page.tsx");
    write("[locale]/@slot/page.tsx");
    write("[locale]/(group)/team/page.tsx");
    write("api/inquiries/route.ts");
    write("internal/concept-pack/page.tsx");
    expect(localePageRoutes(root, ["en"])).toEqual(["/en", "/en/team"]);
  });

  it("fails loudly on a dynamic segment instead of silently skipping the page", () => {
    write("[locale]/page.tsx");
    write("[locale]/work/[slug]/page.tsx");
    expect(() => localePageRoutes(root, ["en"])).toThrow(/dynamic segment/);
  });

  it("covers every public route the site publishes, so a new page cannot be missed", () => {
    const warmed = new Set(localePageRoutes(path.join(process.cwd(), "src", "app"), SUPPORTED_LOCALES));
    for (const locale of SUPPORTED_LOCALES) {
      for (const route of PUBLIC_ROUTE_PATHS) expect(warmed.has(`/${locale}${route}`)).toBe(true);
    }
  });
});

describe("findUnreadableManifests", () => {
  const valid = JSON.stringify({ version: 4, routes: { "/en": {} } });

  it("accepts a folder whose manifests are complete JSON", () => {
    write("dev/prerender-manifest.json", valid);
    write("dev/routes-manifest.json", "{}");
    write("dev/not-a-manifest.txt", "ignored {");
    expect(findUnreadableManifests(path.join(root, "dev"))).toEqual([]);
  });

  it("rejects a half-written manifest (truncated)", () => {
    write("dev/prerender-manifest.json", valid.slice(0, 20));
    const problems = findUnreadableManifests(path.join(root, "dev"));
    expect(problems).toHaveLength(1);
    expect(problems[0].file).toContain("prerender-manifest.json");
  });

  it("rejects a manifest with stray text after the JSON (two writers)", () => {
    write("dev/prerender-manifest.json", `${valid}[]}},"notFoundRoutes":[]}`);
    expect(findUnreadableManifests(path.join(root, "dev"))).toHaveLength(1);
  });

  it("rejects an empty manifest", () => {
    write("dev/prerender-manifest.json", "");
    expect(findUnreadableManifests(path.join(root, "dev"))).toHaveLength(1);
  });

  it("reports every unreadable manifest, not only the first", () => {
    write("dev/prerender-manifest.json", "{");
    write("dev/build-manifest.json", "{");
    write("dev/routes-manifest.json", "{}");
    expect(findUnreadableManifests(path.join(root, "dev"))).toHaveLength(2);
  });

  it("rejects a missing prerender manifest and a missing folder", () => {
    write("dev/routes-manifest.json", "{}");
    expect(findUnreadableManifests(path.join(root, "dev"))).toHaveLength(1);
    expect(findUnreadableManifests(path.join(root, "nowhere"))).toHaveLength(1);
  });
});

describe("assertManifestsReadable", () => {
  it("passes silently for a healthy folder", () => {
    write("dev/prerender-manifest.json", "{}");
    expect(() => assertManifestsReadable(path.join(root, "dev"), "after the warm-up")).not.toThrow();
  });

  it("names the file, the moment, and says the results cannot be trusted", () => {
    write("dev/prerender-manifest.json", "{");
    expect(() => assertManifestsReadable(path.join(root, "dev"), "during the run")).toThrow(
      /corrupted during the run.*cannot be trusted[\s\S]*prerender-manifest\.json/,
    );
  });
});
