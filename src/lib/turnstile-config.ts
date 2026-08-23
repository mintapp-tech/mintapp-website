import "server-only";

export function getTurnstileSecretKey(): string {
  const key = process.env.TURNSTILE_SECRET_KEY;
  if (!key) {
    throw new Error("TURNSTILE_SECRET_KEY must be set in the server environment.");
  }
  return key;
}

// The real, always-required hostname allowlist — mintapp.tech's own
// production hostnames, nothing else. Cloudflare's official dummy test keys
// report a fixed "example.com" hostname regardless of the real page
// (verified empirically), but that exception is scoped narrowly inside
// verify-turnstile.ts to the exact dummy secret key, not added here — this
// list stays the same in every environment so it can never be widened by
// anything less specific than "you are using one of Cloudflare's three
// published dummy secrets, and this is not production."
export function getAllowedTurnstileHostnames(): string[] {
  return ["mintapp.tech", "www.mintapp.tech"];
}
