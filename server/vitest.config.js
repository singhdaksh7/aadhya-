import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    root: here,
    environment: "node",
    // Absolute path — a relative "./tests/setup.js" was observed resolving
    // against the wrong base in this workspace (it silently loaded the
    // *frontend's* tests/setup.js instead), which meant .env.test never
    // actually loaded and every "backend test run" was silently hitting the
    // dev database. Do not change this back to a relative path without
    // re-verifying against a completely fresh `npx vitest run` from server/.
    setupFiles: [path.resolve(here, "tests/setup.js")],
    fileParallelism: false,
    testTimeout: 15000,
  },
});
