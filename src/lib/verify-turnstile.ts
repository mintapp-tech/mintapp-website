import "server-only";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const DEFAULT_TIMEOUT_MS = 5000;

// Cloudflare's three published, publicly documented dummy secret keys
// (always-passes, always-fails, already-spent). Their siteverify responses
// are canned — verified empirically to report hostname "example.com" and no
// "action" field at all, regardless of the real page or configured action.
// The relaxations below activate ONLY when the secret key configured for
// this call is exactly one of these three — never for any other secret,
// dummy-looking or not, so a real (non-dummy) secret in a non-production
// environment still gets the full production-strength check.
const OFFICIAL_DUMMY_SECRET_KEYS = new Set([
  "1x0000000000000000000000000000000AA",
  "2x0000000000000000000000000000000AA",
  "3x0000000000000000000000000000000AA",
]);

export type TurnstileVerifyResult =
  | { ok: true }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "timeout" }
  | { ok: false; reason: "network_error" };

interface SiteverifyResponse {
  success: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
}

export interface VerifyTurnstileOptions {
  secretKey: string;
  expectedAction: string;
  allowedHostnames: string[];
  remoteIp?: string;
  timeoutMs?: number;
  // Injectable for tests — never a real network call in a test run.
  fetchImpl?: typeof fetch;
}

export async function verifyTurnstileToken(token: string, options: VerifyTurnstileOptions): Promise<TurnstileVerifyResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    const body = new URLSearchParams({ secret: options.secretKey, response: token });
    if (options.remoteIp) body.set("remoteip", options.remoteIp);

    response = await fetchImpl(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
    });
  } catch (err) {
    // AbortError (our own timeout) vs. any other fetch failure (DNS, TLS,
    // connection refused, etc.) are both "we couldn't get an answer in
    // time," which the caller treats identically — a temporary, retryable
    // failure, distinct from Cloudflare actively saying no.
    const isAbort = err instanceof Error && err.name === "AbortError";
    console.error(`turnstile_verify_${isAbort ? "timeout" : "network_error"}`);
    return { ok: false, reason: isAbort ? "timeout" : "network_error" };
  } finally {
    clearTimeout(timeout);
  }

  let data: SiteverifyResponse;
  try {
    data = await response.json();
  } catch {
    console.error("turnstile_verify_network_error: unparseable response");
    return { ok: false, reason: "network_error" };
  }

  // Deliberately never logging the full response object (only a short,
  // controlled category plus Cloudflare's own documented error-code
  // strings, which are non-sensitive) and never logging the token itself.
  if (!data.success) {
    console.error("turnstile_verify_failed: cloudflare_rejected", data["error-codes"] ?? []);
    return { ok: false, reason: "invalid" };
  }
  // Scoped narrowly: both relaxations below require this to be true. Never
  // derived from NODE_ENV alone — a real (non-dummy) secret used outside
  // production still gets the exact same checks as production.
  const isProduction = process.env.NODE_ENV === "production";
  const isOfficialDummyKeyTest = !isProduction && OFFICIAL_DUMMY_SECRET_KEYS.has(options.secretKey);

  const effectiveAllowedHostnames = isOfficialDummyKeyTest
    ? [...options.allowedHostnames, "example.com"]
    : options.allowedHostnames;
  if (!data.hostname || !effectiveAllowedHostnames.includes(data.hostname)) {
    console.error("turnstile_verify_failed: hostname_mismatch");
    return { ok: false, reason: "invalid" };
  }
  // Cloudflare's official dummy test keys omit the "action" field from the
  // siteverify response entirely — verified empirically via a real browser
  // rendering the dummy site key, not just an assumption. A missing action
  // is tolerated only for this exact, narrowly-scoped case; every other
  // case (including production, and including non-dummy secrets outside
  // production) requires an exact match.
  const isDummyKeyActionOmission = isOfficialDummyKeyTest && data.action === undefined;
  if (!isDummyKeyActionOmission && data.action !== options.expectedAction) {
    console.error("turnstile_verify_failed: action_mismatch");
    return { ok: false, reason: "invalid" };
  }

  return { ok: true };
}
