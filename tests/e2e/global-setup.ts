import { chromium, type FullConfig } from "@playwright/test";

// The dev server compiles each route's client code on the first browser
// request. On a cold server, parallel workers otherwise trigger many of those
// compiles at once and the first test to reach a page can spend its whole
// timeout waiting for the compiler. Visit the main routes once, in a real
// browser, before any test starts. On a warm server this takes a few seconds.
// Like every test here, it never reaches a third party: all non-local
// requests (Turnstile, Cal.com) are aborted.
const ROUTES = ["/en", "/ar", "/en/start", "/ar/start", "/en/about", "/en/services", "/en/work/rentop"];

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL ?? "http://localhost:3000";
  const origin = new URL(baseURL).origin;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route((url) => url.origin !== origin, (route) => route.abort());
  for (const route of ROUTES) {
    await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle", timeout: 180_000 });
  }
  await browser.close();
}
