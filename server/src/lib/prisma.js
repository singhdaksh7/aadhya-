import { PrismaClient } from "@prisma/client";

// Reuse a single client across hot reloads / test runs.
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__aadyaPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__aadyaPrisma = prisma;
}
