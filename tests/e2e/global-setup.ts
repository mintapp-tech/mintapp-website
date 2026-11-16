import path from "node:path";
import { chromium, type FullConfig } from "@playwright/test";
import { SUPPORTED_LOCALES } from "../../src/lib/locales";
import { assertManifestsReadable, devDistDir, localePageRoutes } from "./dev-server-state";

// The dev server compiles each route on its first request, and the first time
// it sees each dynamic page pattern it also rewrites .next/dev/prerender-manifest.json
// without a lock (see dev-server-state.ts and issue #75). With parallel workers
// reaching un-warmed pages at once, those writes collide, the manifest is
// corrupted, and over a hundred unrelated tests fail with a 500.
//
// So, before any worker starts, request every public page once, one after the
// other, in a real browser, and require a successful answer from each. This
// also compiles each page's client code so the first test to reach a page does
// not spend its timeout waiting for the compiler. A page that does not answer
// successfully stops the run with a message that says which one; nothing is
// retried or skipped. Afterwards the generated manifests must be readable.
//
// Like every test here, it never reaches a third party: all non-local
// requests (Turnstile, Cal.com) are aborted.
export default async function globalSetup(config: FullConfig) {
  const projectRoot = config.configFile ? path.dirname(config.configFile) : process.cwd();
  const baseURL = config.projects[0]?.use?.baseURL ?? "http://localhost:3000";
  const origin = new URL(baseURL).origin;
  const routes = localePageRoutes(path.join(projectRoot, "src", "app"), SUPPORTED_LOCALES);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route((url) => url.origin !== origin, (route) => route.abort());
    for (const route of routes) {
      const response = await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle", timeout: 180_000 });
      const status = response?.status();
      if (status === undefined || status >= 400) {
        throw new Error(
          `Warm-up request for ${route} answered ${status ?? "nothing"}. The dev server is not healthy, ` +
            `so the suite's results would not be reliable. If the server was already running, stop it, delete .next and run again.`,
        );
      }
    }
  } finally {
    await browser.close();
  }

  assertManifestsReadable(devDistDir(projectRoot), "after the warm-up");
}
