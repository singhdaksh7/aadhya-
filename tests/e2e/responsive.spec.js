// Responsive QA sweep across 4 breakpoints (mobile/tablet/laptop/desktop)
// for key storefront, account, and admin pages. Checks for horizontal
// overflow (document.documentElement.scrollWidth <= viewport width) and
// saves a screenshot per page x breakpoint for visual review.
//
// Requires the backend (server/) and frontend dev server already running,
// with a seeded catalog (see server/prisma/seed.js) and an admin user
// matching E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@aadyasociety.example";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "ChangeThisPassword123!";
const CUSTOMER_EMAIL = process.env.E2E_CUSTOMER_EMAIL || "qa-responsive@example.com";
const CUSTOMER_PASSWORD = process.env.E2E_CUSTOMER_PASSWORD || "TestPass123!";
const BOOK_SLUG = process.env.E2E_BOOK_SLUG || "everyday-resilience";
const BOOK_PRODUCT_ID = process.env.E2E_BOOK_PRODUCT_ID || "3fc91065-0148-436e-8616-e716d7dd2a76";

const OUT_DIR = path.resolve("scratch/responsive-screenshots");
fs.mkdirSync(OUT_DIR, { recursive: true });

const BREAKPOINTS = [
  { name: "mobile-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "laptop-1280", width: 1280, height: 800 },
  { name: "desktop-1440", width: 1440, height: 900 },
];

const PUBLIC_PAGES = [
  { name: "homepage", path: "/" },
  { name: "shop", path: "/shop" },
  { name: "pdp-book", path: `/shop/${BOOK_SLUG}` },
  { name: "cart", path: "/cart" },
  { name: "checkout", path: "/checkout" },
  { name: "login", path: "/login" },
  { name: "register", path: "/register" },
];

const ACCOUNT_PAGES = [
  { name: "account-dashboard", path: "/account" },
  { name: "account-downloads", path: "/account/downloads" },
];

const ADMIN_PAGES = [
  { name: "admin-product-edit", path: `/admin/products/${BOOK_PRODUCT_ID}` },
  { name: "admin-orders-list", path: "/admin/orders" },
  { name: "admin-analytics", path: "/admin/analytics" },
];

async function checkNoOverflow(page, label) {
  const { scrollWidth, clientWidth, viewportWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(scrollWidth, `${label}: scrollWidth ${scrollWidth} > viewport ${viewportWidth}`).toBeLessThanOrEqual(
    viewportWidth
  );
  return { scrollWidth, clientWidth, viewportWidth };
}

async function shoot(page, name, bp) {
  await page.screenshot({
    path: path.join(OUT_DIR, `${name}__${bp.name}.png`),
    fullPage: true,
  });
}

test.describe("Responsive QA sweep", () => {
  for (const bp of BREAKPOINTS) {
    test.describe(`breakpoint ${bp.name}`, () => {
      test.use({ viewport: { width: bp.width, height: bp.height } });

      for (const p of PUBLIC_PAGES) {
        test(`public: ${p.name}`, async ({ page }) => {
          await page.goto(p.path, { waitUntil: "networkidle" });
          await page.waitForTimeout(300);
          await checkNoOverflow(page, `${p.name}@${bp.name}`);
          await shoot(page, p.name, bp);
        });
      }

      test(`account pages`, async ({ page }) => {
        await page.goto("/login");
        await page.locator('input[type="email"]').fill(CUSTOMER_EMAIL);
        await page.locator('input[type="password"]').fill(CUSTOMER_PASSWORD);
        await page.locator('button:has-text("Log in")').click();
        await page.waitForURL(/\/account/, { timeout: 15000 }).catch(() => {});

        for (const p of ACCOUNT_PAGES) {
          await page.goto(p.path, { waitUntil: "networkidle" });
          await page.waitForTimeout(300);
          await checkNoOverflow(page, `${p.name}@${bp.name}`);
          await shoot(page, p.name, bp);
        }
      });

      test(`admin pages`, async ({ page }) => {
        await page.goto("/admin/login");
        await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
        await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
        await page.locator('button:has-text("Sign In")').click();
        // The admin nav collapses behind a hamburger menu at mobile widths, so
        // assert on the dashboard heading (always visible) rather than a nav link.
        await page.waitForURL(/\/admin(\/|$)(?!login)/, { timeout: 15000 });
        await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({ timeout: 15000 });

        for (const p of ADMIN_PAGES) {
          await page.goto(p.path, { waitUntil: "networkidle" });
          await page.waitForTimeout(300);
          await checkNoOverflow(page, `${p.name}@${bp.name}`);
          await shoot(page, p.name, bp);
        }
      });
    });
  }
});
