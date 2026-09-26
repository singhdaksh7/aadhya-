import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@aadyasociety.example";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "ChangeThisPassword123!";

test.describe.configure({ mode: "serial" });

async function adminLogin(page) {
  await page.goto("/admin/login");
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.locator('button:has-text("Sign In")').click();
  await page.waitForURL((url) => !url.pathname.includes("/admin/login"));
}

test("Admin to Storefront Settings Integration Roundtrip", async ({ page }) => {
  await adminLogin(page);

  // Navigate to Store Settings
  await page.goto("/admin/settings");
  await expect(page.locator('h1:has-text("Storefront Settings")')).toBeVisible();

  // 1. Change General Support Phone
  const uniquePhone = `+91 99999 ${Math.floor(10000 + Math.random() * 90000)}`;
  const phoneInput = page.locator('label:has-text("Support Phone") + input');
  if (await phoneInput.isVisible()) {
    await phoneInput.fill(uniquePhone);
  }

  // Click Save All Settings
  await page.locator('button:has-text("Save All Settings")').first().click();
  await expect(page.locator("text=Store settings successfully saved")).toBeVisible();

  // 2. Verify on public storefront
  await page.goto("/");
  await expect(page.locator("footer")).toBeVisible();
  await expect(page.locator(`text=${uniquePhone}`)).toBeVisible();

  // 3. Reset settings / clean up
  await page.goto("/admin/settings");
  const phoneInputReset = page.locator('label:has-text("Support Phone") + input');
  if (await phoneInputReset.isVisible()) {
    await phoneInputReset.fill("+91 (800) 242-3921");
    await page.locator('button:has-text("Save All Settings")').first().click();
    await expect(page.locator("text=Store settings successfully saved")).toBeVisible();
  }
});
