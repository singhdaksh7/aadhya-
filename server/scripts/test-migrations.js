import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const TEST_DB_URL = "postgresql://aadya:aadya_dev_pw@localhost:5436/aadya_test?schema=public";
const phaseGMigrationDir = path.join(process.cwd(), "prisma", "migrations", "20260926140000_phase_g_reviews_wishlist_account");
const tempPhaseGMigrationDir = path.join(process.cwd(), "prisma", "temp_20260926140000_phase_g_reviews_wishlist_account");

async function run() {
  console.log("=== 1. Testing migration from EMPTY DATABASE to HEAD ===");
  const prisma = new PrismaClient({
    datasources: { db: { url: TEST_DB_URL } },
  });

  // Drop schema public and recreate empty
  await prisma.$executeRawUnsafe("DROP SCHEMA public CASCADE;");
  await prisma.$executeRawUnsafe("CREATE SCHEMA public;");
  console.log("Cleared database to empty public schema.");
  await prisma.$disconnect();

  // Run migrate deploy on empty DB
  console.log("Running: npx prisma migrate deploy (on empty DB)");
  execSync("npx prisma migrate deploy", {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: "inherit",
  });
  console.log("--> Migration from EMPTY DB: PASS\n");

  console.log("=== 2. Testing migration against database already migrated to baseline ===");
  // Reset DB
  await prisma.$connect();
  await prisma.$executeRawUnsafe("DROP SCHEMA public CASCADE;");
  await prisma.$executeRawUnsafe("CREATE SCHEMA public;");
  await prisma.$disconnect();

  // Hide Phase G migration temporarily to migrate up to baseline
  fs.renameSync(phaseGMigrationDir, tempPhaseGMigrationDir);
  try {
    console.log("Migrating database up to baseline (without Phase G)...");
    execSync("npx prisma migrate deploy", {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: TEST_DB_URL },
      stdio: "inherit",
    });
    console.log("Baseline migration complete.");
  } finally {
    // Restore Phase G migration
    fs.renameSync(tempPhaseGMigrationDir, phaseGMigrationDir);
  }

  // Now apply Phase G migration on top of existing baseline DB
  console.log("Running: npx prisma migrate deploy (applying Phase G onto baseline DB)...");
  execSync("npx prisma migrate deploy", {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: "inherit",
  });
  console.log("--> Migration from BASELINE DB: PASS\n");
}

run().catch((e) => {
  if (fs.existsSync(tempPhaseGMigrationDir)) {
    fs.renameSync(tempPhaseGMigrationDir, phaseGMigrationDir);
  }
  console.error("Migration test failed:", e);
  process.exit(1);
});

