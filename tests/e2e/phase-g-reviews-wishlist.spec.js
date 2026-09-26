import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@aadyasociety.example";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "ChangeThisPassword123!";
const API_URL = process.env.E2E_API_URL || "http://localhost:4100/api";

const RUN_ID = Date.now();
const CUSTOMER_NAME = `E2E Tester ${RUN_ID}`;
const CUSTOMER_EMAIL = `e2e_tester_${RUN_ID}@example.com`;
const CUSTOMER_PASS = "TestPassword123!";

test.describe.configure({ mode: "serial" });

let targetProductSlug;
let targetProductId;
let targetProductName;

test.beforeAll(async ({ request }) => {
  // Fetch an active product from public shop
  const res = await request.get(`${API_URL}/products`);
  const json = await res.json();
  const products = json.data || [];
  if (products.length > 0) {
    targetProductSlug = products[0].slug;
    targetProductId = products[0].id;
    targetProductName = products[0].name;
  }
});

async function customerLogin(page) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(CUSTOMER_EMAIL);
  await page.locator('input[type="password"]').fill(CUSTOMER_PASS);
  await page.locator('button:has-text("Log in")').click();
  await expect(page).toHaveURL(/\/account/);
}

async function adminLogin(page) {
  await page.goto("/admin/login");
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.locator('button:has-text("Sign In")').click();
  await expect(page.locator('a:has-text("Reviews")').first()).toBeVisible();
}

test("Scenario 1: Customer registers account", async ({ page }) => {
  await page.goto("/register");
  await page.locator('input[placeholder="Name"]').fill(CUSTOMER_NAME);
  await page.locator('input[type="email"]').fill(CUSTOMER_EMAIL);
  await page.locator('input[type="password"]').fill(CUSTOMER_PASS);
  await page.locator('button:has-text("Create account")').click();
  await expect(page).toHaveURL(/\/account/);
});

test("Scenario 2: Customer submits product review and verifies moderation pipeline", async ({ page }) => {
  expect(targetProductSlug).toBeTruthy();

  // 1. Customer logs in and visits PDP
  await customerLogin(page);
  await page.goto(`/shop/${targetProductSlug}`);
  await expect(page.locator("h1")).toContainText(targetProductName);

  // 2. Submit a review
  const writeBtn = page.locator('button:has-text("Write a Review")');
  await writeBtn.waitFor({ state: "visible", timeout: 10000 });
  await writeBtn.click();

  const reviewTitle = `E2E Review Title ${RUN_ID}`;
  const reviewComment = `This object exceeds expectations. Playwright test run ${RUN_ID}.`;

  await page.locator('input[placeholder*="Beautiful slow craftsmanship"]').fill(reviewTitle);
  await page.locator('textarea[placeholder*="Share details"]').fill(reviewComment);
  await page.locator('button:has-text("Submit Review")').first().click();

  // 3. Confirm pending submission message
  await expect(page.locator('text=submitted for administrator approval')).toBeVisible();

  // 4. Confirm public PDP does NOT show review yet
  await page.reload();
  await expect(page.locator(`text=${reviewTitle}`)).not.toBeVisible();

  // 5. Admin approves review
  await adminLogin(page);
  await page.goto("/admin/reviews");
  await expect(page.locator("h1")).toContainText("Product Reviews");

  // Filter or search for review
  await page.locator('input[placeholder*="Search comment, product, customer..."]').fill(reviewTitle);
  await page.waitForTimeout(300);
  const targetRow = page.locator("tr", { hasText: reviewTitle });
  await expect(targetRow).toBeVisible();

  // Click Approve inside target row
  await targetRow.locator('button:has-text("Approve")').click();
  await expect(page.locator("text=/Review updated/i")).toBeVisible();

  // 6. Confirm public PDP now displays approved review
  await page.goto(`/shop/${targetProductSlug}`);
  await expect(page.locator(`text=${reviewTitle}`).first()).toBeVisible();
  await expect(page.locator(`text=${reviewComment}`).first()).toBeVisible();

  // 7. Customer account shows Published status
  await customerLogin(page);
  await page.goto("/account/reviews");
  await expect(page.locator(`text=${reviewTitle}`)).toBeVisible();
  await expect(page.locator("text=/Published/i")).toBeVisible();
});

test("Scenario 3: Wishlist lifecycle — toggle, persistent state, move to cart, and removal", async ({ page }) => {
  await customerLogin(page);

  // 1. Navigate to PDP and toggle wishlist
  await page.goto(`/shop/${targetProductSlug}`);
  const wishlistBtn = page.locator('button[aria-label*="Wishlist"]').first();
  await wishlistBtn.click();

  // 2. Go to Account Wishlist
  await page.goto("/account/wishlist");
  await expect(page.locator("h1, h2")).toContainText("My Wishlist");
  await expect(page.locator(`text=${targetProductName}`)).toBeVisible();

  // 3. Move to cart
  const moveBtn = page.locator('button:has-text("Move to Cart"), button:has-text("Select Option")').first();
  await moveBtn.click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  if (!page.url().includes("/account/wishlist")) {
    await page.goto("/account/wishlist");
  }

  // 4. Remove from wishlist
  const removeBtn = page.locator('button:has-text("Remove")').first();
  if (await removeBtn.isVisible()) {
    await removeBtn.click({ force: true });
  }

  // 5. Verify wishlist is updated
  await page.reload();
  await expect(page.locator(`text=${targetProductName}`)).not.toBeVisible();
});
