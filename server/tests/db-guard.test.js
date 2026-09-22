import { describe, it, expect, afterEach, afterAll } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { resetDb } from "./helpers.js";

// These tests exercise the exact same guard predicate that both
// scripts/prepare-test-db.js and tests/helpers.js::resetDb() enforce:
//   NODE_ENV === "test" AND DATABASE_URL matches /(_test|test)/i
//
// Note: Prisma's underlying connection was already established at process
// start against the real .env.test DATABASE_URL — mutating process.env
// here only changes what the guard's string check reads, never the actual
// live connection. So a test that "should be blocked" can never accidentally
// reach a different database; it can only prove the guard throws first.
const originalNodeEnv = process.env.NODE_ENV;
const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  process.env.DATABASE_URL = originalDatabaseUrl;
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("test database safety guard", () => {
  it("refuses to reset when NODE_ENV is not exactly 'test'", async () => {
    process.env.NODE_ENV = "development";
    await expect(resetDb()).rejects.toThrow(/Refusing/i);
  });

  it("refuses to reset when NODE_ENV is production", async () => {
    process.env.NODE_ENV = "production";
    await expect(resetDb()).rejects.toThrow(/Refusing/i);
  });

  it("refuses to reset when DATABASE_URL does not look like a dedicated test database", async () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = "postgresql://aadya:pw@localhost:5432/aadya_development?schema=public";
    await expect(resetDb()).rejects.toThrow(/Refusing/i);
  });

  it("refuses to reset when DATABASE_URL is empty", async () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = "";
    await expect(resetDb()).rejects.toThrow(/Refusing/i);
  });

  it("accepts the expected dedicated test database name and NODE_ENV", async () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = originalDatabaseUrl; // the real .env.test value, which does contain "test"
    await expect(resetDb()).resolves.not.toThrow();
  });

  it("the real .env.test DATABASE_URL used by this whole suite does point at a dedicated test database", () => {
    expect(originalNodeEnv).toBe("test");
    expect(/(_test|test)/i.test(originalDatabaseUrl || "")).toBe(true);
  });
});
