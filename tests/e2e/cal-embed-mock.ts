import type { Page } from "@playwright/test";

// Faithfully mirrors just enough of @calcom/embed-react's real runtime
// surface (verified directly against its published source: EmbedSnippet's
// `window.Cal = window.Cal || fn` guard, the namespaced `Cal.ns[namespace]`
// instance, and SdkActionManager's `CAL:<namespace>:<action>` event naming)
// so ScheduleEmbed's real, unmodified code runs against this mock exactly
// as it would against the real SDK — without ever loading real Cal.com
// script or reaching app.cal.com. This suite must never make a real
// network call to Cal.com.
export async function installCalEmbedMock(page: Page) {
  await page.addInitScript(() => {
    const state: { inlineCalls: { calLink: string; config: Record<string, unknown> }[] } = { inlineCalls: [] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__calEmbedMock = state;

    function makeNamespaceApi(namespace: string) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (method: string, arg?: any) => {
        if (method === "inline") {
          state.inlineCalls.push({ calLink: arg?.calLink, config: arg?.config ?? {} });
        } else if (method === "on") {
          window.addEventListener(`CAL:${namespace}:${arg.action}`, arg.callback);
        } else if (method === "off") {
          window.removeEventListener(`CAL:${namespace}:${arg.action}`, arg.callback);
        }
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globalCal: any = (method: string, ...args: any[]) => {
      if (method === "init") {
        const namespace = typeof args[0] === "string" ? args[0] : "";
        if (namespace) {
          globalCal.ns[namespace] = globalCal.ns[namespace] || makeNamespaceApi(namespace);
        }
      }
    };
    globalCal.ns = {};
    globalCal.loaded = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Cal = globalCal;
  });

  // Belt-and-suspenders: window.Cal already existing (set above, before any
  // page script runs) means EmbedSnippet's `window.Cal = window.Cal || ...`
  // guard never overwrites it and the real loader script is never even
  // requested — but block it outright too.
  await page.route("**/app.cal.com/**", (route) => route.abort());
}

export async function fireCalEvent(page: Page, namespace: string, action: string, detail: unknown = {}) {
  await page.evaluate(
    ({ namespace, action, detail }) => {
      window.dispatchEvent(new CustomEvent(`CAL:${namespace}:${action}`, { detail }));
    },
    { namespace, action, detail },
  );
}

export async function getRecordedInlineCalls(page: Page) {
  return page.evaluate(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__calEmbedMock.inlineCalls as { calLink: string; config: Record<string, unknown> }[],
  );
}
