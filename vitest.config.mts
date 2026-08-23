import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Vitest already sets NODE_ENV=test by default when unset; asserted
    // explicitly here because the real-email fail-safe (email-sending-mode.ts)
    // and the Turnstile dummy-key relaxation both key safety-critical
    // behavior off NODE_ENV === "test" — this suite must never silently run
    // under anything else.
    env: { NODE_ENV: "test" },
  },
  resolve: {
    alias: {
      // Next.js's bundler aliases "server-only" to a no-op for server
      // bundles; outside that bundler the raw package always throws. Same
      // shim technique Next's own docs suggest for testing server-only code.
      "server-only": fileURLToPath(new URL("./vitest-setup/server-only-shim.ts", import.meta.url)),
      // Mirrors tsconfig.json's "@/*" -> "./src/*" path mapping.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
