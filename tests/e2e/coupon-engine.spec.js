import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@aadyasociety.example";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "ChangeThisPassword123!";
const API_URL = process.env.E2E_API_URL || "http://localhost:4100/api";

const RUN_ID = Date.now();
const COUPON_CODE = `PWCOUPON${RUN_ID.toString().slice(-4)}`;

test.describe.configure({ mode: "serial" });

async function adminLogin(page) {
  await page.goto("/admin/login");
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.locator('button:has-text("Sign In")').click();
  await expect(page.locator('a:has-text("Products")').first()).toBeVisible();
}

test("admin creates a coupon and storefront applies discount", async ({ page }) => {
  await adminLogin(page);

  // Navigate to Coupons management
  await page.goto("/admin/coupons");
  await expect(page.locator("h1")).toContainText("Coupons & Offers");

  // Fill coupon form
  await page.locator('input[placeholder="e.g. WELCOME10"]').fill(COUPON_CODE);
  await page.locator('input[placeholder="e.g. 10% Welcome Discount"]').fill("10% E2E Promo");
  await page.locator('input[placeholder="10"]').fill("10"); // 10% value
  await page.locator('input[placeholder="0"]').first().fill("100"); // min order 100

  await page.locator('button:has-text("Create Coupon")').click();
  await expect(page.locator("body")).toContainText(COUPON_CODE);

  // Now test storefront application
  await page.goto("/shop");
  const firstProduct = page.locator('a[href^="/shop/"]').first();
  await firstProduct.click();

  // Add product to cart
  const addToCartBtn = page.locator('button:has-text("Add to Cart")').first();
  await addToCartBtn.click();

  // Go to Cart page
  await page.goto("/cart");
  await expect(page.locator("h1")).toContainText("Shopping Cart");

  // Apply Coupon
  const couponInput = page.locator('input[placeholder="Enter coupon code"]');
  await couponInput.fill(COUPON_CODE);
  await page.locator('button:has-text("Apply")').click();

  // Verify Coupon is applied
  await expect(page.locator("body")).toContainText(`Coupon Applied: ${COUPON_CODE}`);
  await expect(page.locator("body")).toContainText("Coupon Discount");

  // Proceed to Checkout
  await page.locator('a:has-text("Proceed to Checkout")').click();
  await expect(page.locator("body")).toContainText("Order Summary");
  await expect(page.locator("body")).toContainText(`Coupon Discount (${COUPON_CODE})`);
});
