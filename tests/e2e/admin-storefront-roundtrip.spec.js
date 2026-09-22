// Cross-system E2E: proves the admin panel is the real source of truth for
// storefront merchandising — admin creates a product, it appears live on the
// public storefront (catalog, PDP, cart), an admin edit propagates, a stock
// change disables purchase (both in the UI and at the API), and restocking
// re-enables it. Requires the backend (server/) and this app's dev server to
// already be running — see server/.env for DATABASE_URL/ADMIN_* and this
// project's .env.development for VITE_API_URL.
import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@aadyasociety.example";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "ChangeThisPassword123!";
const API_URL = process.env.E2E_API_URL || "http://localhost:4100/api";

const RUN_ID = Date.now();
const PRODUCT_NAME = `Playwright E2E Vase ${RUN_ID}`;
const PRODUCT_SKU = `PW-E2E-${RUN_ID}`;

test.describe.configure({ mode: "serial" });

let productId;
let productSlug;

async function adminLogin(page) {
  await page.goto("/admin/login");
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.locator('button:has-text("Sign In")').click();
  await page.waitForURL(/\/admin\/?$/);
}

async function setStock(page, quantity) {
  await page.goto(`/admin/products/${productId}`);
  await page.getByLabel("Stock Quantity", { exact: true }).fill(String(quantity));
  await page.locator('button:has-text("Save Changes")').click();
  await page.waitForURL(/\/admin\/products$/);
}

test("admin creates a product and it appears on the storefront", async ({ page }) => {
  await adminLogin(page);

  await page.goto("/admin/products/new");
  await page.getByLabel("Name", { exact: true }).fill(PRODUCT_NAME);
  await page.locator("select").nth(0).selectOption("PHYSICAL");
  await page.locator("select").nth(1).selectOption({ label: "Home Decor" });
  await page.getByLabel("SKU", { exact: true }).fill(PRODUCT_SKU);
  await page.getByLabel("Price", { exact: true }).fill("1299");
  await page.getByLabel("Sale Price", { exact: true }).fill("999");
  await page.getByLabel("Stock Quantity", { exact: true }).fill("5");
  await page.getByLabel(/^Short Description/).fill("Playwright integration test fixture.");
  await page.locator('button:has-text("Create Product")').click();
  await page.waitForURL(/\/admin\/products\/[0-9a-f-]{36}$/);

  productId = page.url().split("/").pop();
  // The create form doesn't surface the generated slug directly, so derive
  // it from the public product search instead.
  const list = await page.request.get(`${API_URL}/products?search=${encodeURIComponent(PRODUCT_NAME)}`).then((r) => r.json());
  productSlug = list.data[0]?.slug;
  expect(productSlug).toBeTruthy();

  await page.goto("/shop");
  await expect(page.locator(`text=${PRODUCT_NAME}`)).toHaveCount(1);

  await page.goto(`/shop/${productSlug}`);
  await expect(page.locator("body")).toContainText(PRODUCT_NAME);
  await expect(page.locator("body")).toContainText("999");
  await expect(page.locator('button:has-text("Add to Cart")')).toBeVisible();
});

test("admin edit propagates to the storefront", async ({ page }) => {
  await adminLogin(page);
  await page.goto(`/admin/products/${productId}`);
  await page.getByLabel("Price", { exact: true }).fill("1099");
  await page.getByLabel("Stock Quantity", { exact: true }).fill("2");
  await page.locator('button:has-text("Save Changes")').click();
  await page.waitForURL(/\/admin\/products$/);

  await page.goto(`/shop/${productSlug}`);
  await expect(page.locator("body")).toContainText(/1,099|1099/);
});

test("stock 0 shows Out of Stock and disables purchase in the UI", async ({ page }) => {
  await adminLogin(page);
  await setStock(page, 0);

  await page.goto(`/shop/${productSlug}`);
  await expect(page.locator("body")).toContainText(/Sold Out|Out of Stock/i);
  await expect(page.locator('button:has-text("Add to Cart")')).toHaveCount(0);
});

test("a forged add-to-cart request for the out-of-stock product is rejected server-side", async ({ page, request }) => {
  const email = `pw-forge-${RUN_ID}@example.com`;
  const reg = await request.post(`${API_URL}/auth/register`, {
    data: { name: "Forge Test", email, password: "ForgePassword123!" },
  });
  expect(reg.ok()).toBeTruthy();
  const { accessToken } = (await reg.json()).data;

  const forged = await request.post(`${API_URL}/cart/items`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { slug: productSlug, quantity: 1 },
  });
  expect(forged.status()).toBe(400);
  const body = await forged.json();
  expect(body.success).toBe(false);
});

test("restocking makes the product purchasable again", async ({ page }) => {
  await adminLogin(page);
  await setStock(page, 3);

  await page.goto(`/shop/${productSlug}`);
  await expect(page.locator('button:has-text("Add to Cart")')).toBeVisible();
});
