import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../.env.test"), override: true });
process.env.NODE_ENV = "test";
// Credential encryption needs a key; .env.test is gitignored and may not define one. This fixed key is for the
// throwaway test database only and is never used outside tests.
process.env.INTEGRATION_ENCRYPTION_KEY = process.env.INTEGRATION_ENCRYPTION_KEY || "0".repeat(63) + "1";
