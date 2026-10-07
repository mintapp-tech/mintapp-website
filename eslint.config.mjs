import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    // The admin application's build output (APP_SURFACE=admin).
    ".next-admin/**",
    // Generated local output, all git-ignored: review screenshots and builds,
    // email previews, test and coverage reports. Source, tests and scripts
    // are not listed here and stay linted.
    "review/**",
    ".email-previews/**",
    "test-results/**",
    "playwright-report/**",
    "blob-report/**",
    "coverage/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
