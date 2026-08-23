import type { Page } from "@playwright/test";

// Injects a synthetic window.turnstile BEFORE any page script runs, so
// TurnstileWidget's `if (window.turnstile) { renderWidget(); return; }` fast
// path picks it up directly and never loads (or needs) the real Cloudflare
// script. This lets tests trigger success/expired/error/timeout callbacks
// deterministically and instantly — no real widget, no real network call,
// no waiting on real Cloudflare timing (including the real ~5 minute
// expiry, which this suite must not wait for).
export async function installTurnstileMock(page: Page, opts: { autoComplete?: boolean } = {}) {
  const autoComplete = opts.autoComplete ?? true;
  await page.addInitScript((autoComplete) => {
    const state: {
      renders: { id: string; options: Record<string, (...a: unknown[]) => void> }[];
      resetCount: number;
    } = { renders: [], resetCount: 0 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__turnstileMock = state;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).turnstile = {
      render(_container: HTMLElement, options: Record<string, (...a: unknown[]) => void>) {
        const id = `mock-widget-${state.renders.length}`;
        state.renders.push({ id, options });
        if (autoComplete) {
          setTimeout(() => (options.callback as (t: string) => void)(`mock-token-${id}`), 5);
        }
        return id;
      },
      reset(id: string) {
        const entry = state.renders.find((r) => r.id === id);
        if (!entry) return;
        state.resetCount += 1;
        setTimeout(() => (entry.options.callback as (t: string) => void)(`mock-token-reset-${state.resetCount}`), 5);
      },
      remove() {},
    };
  }, autoComplete);

  // Belt-and-suspenders: the real script should never even be requested
  // once window.turnstile already exists, but block it outright too.
  await page.route("**/challenges.cloudflare.com/**", (route) => route.abort());
}

export async function triggerTurnstileCallback(page: Page, key: "expired-callback" | "error-callback" | "timeout-callback") {
  await page.evaluate((key) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = (window as any).__turnstileMock;
    const last = state?.renders[state.renders.length - 1];
    const fn = last?.options[key] as (() => void) | undefined;
    fn?.();
  }, key);
}

export async function mockInquiriesRoute(page: Page, respond: (postData: string | null) => { status: number; body: unknown }) {
  const requests: string[] = [];
  await page.route("**/api/inquiries", (route) => {
    const postData = route.request().postData();
    if (postData) requests.push(postData);
    const { status, body } = respond(postData);
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  return requests;
}
