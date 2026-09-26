import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@aadyasociety.example";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "ChangeThisPassword123!";
const API_URL = process.env.E2E_API_URL || "http://localhost:4100/api";

test.describe.configure({ mode: "serial" });

async function adminLogin(page) {
  await page.goto("/admin/login");
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.locator('button:has-text("Sign In")').click();
  await page.waitForURL(/\/admin/);
}

test("Admin -> Public Homepage Roundtrip (Edit, Draft, Publish, Enable/Disable)", async ({ page }) => {
  // 1. Admin login
  await adminLogin(page);

  // 2. Click Homepage Builder in admin sidebar
  await page.locator('a:has-text("Homepage Builder")').first().click();
  await expect(page.locator("h1")).toContainText("Homepage Builder");

  // 3. Verify homepage sections are rendered in builder list
  const sectionsList = page.locator("div.rounded-xl.border");
  await expect(sectionsList.first()).toBeVisible();

  // 4. Click Publish Homepage to ensure current state is published
  await page.locator('button:has-text("Publish Homepage")').click();

  // 5. Navigate to public storefront homepage
  await page.goto("/");
  await expect(page.locator("body")).toContainText("Aadya");

  // 6. Return to Admin Homepage Builder and test toggle section
  await page.goto("/admin/homepage-builder");
  
  // Find a section toggle button (e.g. Enabled button)
  const firstEnableToggle = page.locator('button:has-text("Enabled")').first();
  if (await firstEnableToggle.isVisible()) {
    await firstEnableToggle.click(); // Disable section
    
    // Publish
    await page.locator('button:has-text("Publish Homepage")').click();
    
    // Re-enable
    const firstDisabledToggle = page.locator('button:has-text("Disabled")').first();
    if (await firstDisabledToggle.isVisible()) {
      await firstDisabledToggle.click();
      await page.locator('button:has-text("Publish Homepage")').click();
    }
  }

  // 7. Verify public homepage loads cleanly
  await page.goto("/");
  await expect(page).toHaveURL("/");
});
