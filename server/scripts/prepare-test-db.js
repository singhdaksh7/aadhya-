import dotenv from "dotenv";
import { spawnSync } from "node:child_process";

dotenv.config({ path: ".env.test" });
if (process.env.NODE_ENV !== "test" || !/(_test|test)/i.test(process.env.DATABASE_URL || "")) {
  throw new Error("Refusing Prisma test setup unless NODE_ENV is exactly test and DATABASE_URL is a dedicated test database.");
}

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "test" },
  shell: true,
});

process.exit(result.status ?? 1);
