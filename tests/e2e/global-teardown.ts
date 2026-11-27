import path from "node:path";
import type { FullConfig } from "@playwright/test";
import { assertManifestsReadable, devDistDir } from "./dev-server-state";

// Fails the run, with an explicit cause, if the dev server's generated files
// were corrupted while the suite ran (issue #75). Without this, the symptom is
// a long list of unrelated 500s that looks like a product problem.
export default async function globalTeardown(config: FullConfig) {
  const projectRoot = config.configFile ? path.dirname(config.configFile) : process.cwd();
  assertManifestsReadable(devDistDir(projectRoot), "during the run");
}
