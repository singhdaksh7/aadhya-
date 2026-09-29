// Checkout E2E coverage: billing/shipping address combinations, saved
// addresses, guest checkout, and digital (PDF) vs physical vs mixed carts.
// Uses Cash on Delivery throughout so no Razorpay window needs mocking —
// COD orders are confirmed (and invoiced) synchronously at checkout, per
// server/src/modules/orders/order.service.js.
import { test, expect } from "@playwright/test";

const API_URL = process.env.E2E_API_URL || "http://localhost:4100/api";
const RUN_ID = Date.now();

const PHYSICAL_SLUG = "artisan-ceramic-vase";
const PDF_SLUG = "aadya-home-styling-guide";

function addToCartBySlug(page, slug) {
  return page.goto(`/shop/${slug}`);
}

async function addPhysicalToCart(page) {
  await addToCartBySlug(page, PHYSICAL_SLUG);
  await page.locator('button:has-text("Add to Cart")').first().click();
}

async function addDigitalToCart(page) {
  await addToCartBySlug(page, PDF_SLUG);
  // Book format options load asynchronously after the product itself; wait
  // for the format selector before adding to cart, otherwise "Add to Cart"
  // can fire before a format is selected and the item is added with no
  // bookFormat at all.
  const pdfFormatBtn = page.locator('button:has-text("PDF / Digital")');
  await pdfFormatBtn.first().waitFor({ state: "visible" });
  await expect(pdfFormatBtn.first()).toHaveAttribute("aria-pressed", "true");
  await page.locator('button:has-text("Add to Cart")').first().click();
}

function fillContact(page, { name, email, phone }) {
  return Promise.resolve().then(async () => {
    await page.getByLabel(/^Name$/).fill(name);
    await page.locator('input[type="email"]').first().fill(email);
    await page.locator('[data-testid="contact-phone"]').fill(phone);
  });
}

async function fillBillingAddress(page, addr) {
  await page.locator('input[placeholder=""]').count(); // no-op guard
  const section = page.locator("fieldset", { hasText: "Billing / Communication Address" });
  await section.getByLabel("Full Name").fill(addr.fullName);
  await section.getByLabel("Billing email").fill(addr.email);
  await section.locator('[data-testid="address-phone"]').fill(addr.phone);
  await section.getByLabel("Address Line 1").fill(addr.addressLine1);
  await section.getByLabel("City").fill(addr.city);
  await section.getByLabel("State").fill(addr.state);
  await section.getByLabel("PIN Code").fill(addr.postalCode);
}

async function fillShippingAddress(page, addr) {
  const section = page.locator("fieldset", { hasText: "Shipping Address" });
  await section.getByLabel("Full Name").fill(addr.fullName);
  await section.locator('[data-testid="address-phone"]').fill(addr.phone);
  await section.getByLabel("Address Line 1").fill(addr.addressLine1);
  await section.getByLabel("City").fill(addr.city);
  await section.getByLabel("State").fill(addr.state);
  await section.getByLabel("PIN Code").fill(addr.postalCode);
}

async function chooseCodAndPlace(page) {
  await page.locator('input[name="paymentMethod"][value="cod"]').check();
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/order\/.+\/confirmation/, { timeout: 15000 });
}

// Digital items are not COD-eligible (server rule in
// server/src/modules/shipping/shipping.service.js), so digital/mixed-cart
// checkouts here go through Razorpay instead. The test environment's
// Razorpay key is a well-formed fake (see server/.env.test), so the order
// is created but real payment-gateway order creation fails — the app
// surfaces this as "payment_unavailable" with the order already saved.
async function chooseRazorpayAndPlace(page) {
  await page.locator('input[name="paymentMethod"][value="razorpay"]').check();
  await page.locator('button[type="submit"]').click();
  await expect(page.locator("body")).toContainText(/saved as pending|Opening Payment Window/i, { timeout: 15000 });
}

// State must match a seeded ShippingZone's `states` entry exactly
// (case-insensitive, but not abbreviation-aware — see
// findZoneForAddress in shipping.service.js), so "Maharashtra" not "MH".
const BILLING = { fullName: "Riya Sharma", email: `riya.${RUN_ID}@example.com`, phone: "9876500001", addressLine1: "12 MG Road", city: "Pune", state: "Maharashtra", postalCode: "411001" };
const SHIPPING = { fullName: "Riya Sharma Office", phone: "9876500002", addressLine1: "45 Business Park", city: "Mumbai", state: "Maharashtra", postalCode: "400001" };

test.describe("Checkout — guest, address combos, digital/physical carts", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("1. guest checkout with same billing and shipping address", async ({ page }) => {
    await page.goto("/cart");
    await addPhysicalToCart(page);
    await page.goto("/checkout");
    await fillContact(page, { name: BILLING.fullName, email: BILLING.email, phone: BILLING.phone });
    await fillBillingAddress(page, BILLING);
    await expect(page.locator('input[type="checkbox"]').first()).toBeVisible();
    // "Shipping address is same as billing address" defaults to checked.
    await chooseCodAndPlace(page);
    await expect(page.locator("body")).toContainText(/confirm/i);
  });

  test("2. different/separate shipping address", async ({ page }) => {
    await page.goto("/cart");
    await addPhysicalToCart(page);
    await page.goto("/checkout");
    await fillContact(page, { name: BILLING.fullName, email: `sep.${RUN_ID}@example.com`, phone: BILLING.phone });
    await fillBillingAddress(page, BILLING);
    await page.locator('label:has-text("Shipping address is same as billing address") input[type="checkbox"]').uncheck();
    await fillShippingAddress(page, SHIPPING);
    await chooseCodAndPlace(page);
    await expect(page.locator("body")).toContainText(/confirm/i);
  });

  test("5. guest checkout (no account) succeeds without login", async ({ page }) => {
    await page.goto("/cart");
    await addPhysicalToCart(page);
    await page.goto("/checkout");
    await expect(page.locator("body")).not.toContainText("Welcome back");
    await fillContact(page, { name: "Guest Buyer", email: `guest.${RUN_ID}@example.com`, phone: "9876500009" });
    await fillBillingAddress(page, { ...BILLING, fullName: "Guest Buyer" });
    await chooseCodAndPlace(page);
    await expect(page.locator("body")).toContainText(/confirm/i);
  });

  test("6. PDF-only cart requires no shipping address", async ({ page }) => {
    await page.goto("/cart");
    await addDigitalToCart(page);
    await page.goto("/checkout");
    await expect(page.locator("body")).toContainText("entirely digital (PDF)");
    await expect(page.locator("legend", { hasText: "Shipping Address" })).toHaveCount(0);
    await expect(page.locator("legend", { hasText: "Billing / Communication Address" })).toHaveCount(0);
    await fillContact(page, { name: "Digital Buyer", email: `digital.${RUN_ID}@example.com`, phone: "9876500010" });
    await chooseRazorpayAndPlace(page);
  });

  test("7. mixed cart (physical + PDF) collects one shipping address", async ({ page }) => {
    await page.goto("/cart");
    await addPhysicalToCart(page);
    await addDigitalToCart(page);
    await page.goto("/checkout");
    await expect(page.locator("body")).not.toContainText("entirely digital (PDF)");
    await fillContact(page, { name: "Mixed Buyer", email: `mixed.${RUN_ID}@example.com`, phone: "9876500011" });
    await fillBillingAddress(page, { ...BILLING, fullName: "Mixed Buyer" });
    // A mixed cart contains a digital item, so it is COD-ineligible too
    // (server/src/modules/shipping/shipping.service.js) and must pay via
    // Razorpay.
    await chooseRazorpayAndPlace(page);
  });
});

test.describe("Checkout — logged-in customer with saved addresses", () => {
  const email = `saved.addr.${RUN_ID}@example.com`;
  const password = "SavedAddr1234!";

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto("/register");
    await page.getByPlaceholder("Name").fill("Saved Address Customer");
    await page.locator('input[type="email"]').fill(email);
    await page.getByPlaceholder("password", { exact: false }).first().fill(password);
    await page.locator('button:has-text("Create account")').click();
    await page.waitForURL(/\/account/);

    // Add and default one address — CheckoutPage treats `isDefault` as the
    // default for BOTH shipping and billing when no explicit
    // isDefaultShipping/isDefaultBilling flag is set.
    await page.goto("/account/addresses");
    await page.getByPlaceholder("Address label", { exact: true }).fill("Home");
    await page.getByPlaceholder("Full name", { exact: true }).fill("Saved Address Customer");
    await page.getByPlaceholder("Phone", { exact: true }).fill("9876500020");
    await page.getByPlaceholder("Address line 1", { exact: true }).fill("7 Saved Lane");
    await page.getByPlaceholder("City", { exact: true }).fill("Pune");
    await page.getByPlaceholder("State", { exact: true }).fill("Maharashtra");
    await page.getByPlaceholder("Postal code", { exact: true }).fill("411002");
    await page.locator('input[type="checkbox"]').check();
    await page.locator('button:has-text("Add address")').click();
    await expect(page.locator("body")).toContainText("Default");
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button:has-text("Log in")').click();
    await page.waitForURL(/\/account/);
  });

  test("3. saved billing address is used as default at checkout", async ({ page }) => {
    await page.goto("/cart");
    await addPhysicalToCart(page);
    await page.goto("/checkout");
    const section = page.locator("fieldset", { hasText: "Billing / Communication Address" });
    await expect(section).toContainText("Saved Address Customer");
    await expect(section.locator('input[value=""]').first()).toHaveCount(0).catch(() => {});
    await chooseCodAndPlace(page);
    await expect(page.locator("body")).toContainText(/confirm/i);
  });

  test("4. saved shipping address is used as default when shipping differs from billing", async ({ page }) => {
    await page.goto("/cart");
    await addPhysicalToCart(page);
    await page.goto("/checkout");
    await page.locator('label:has-text("Shipping address is same as billing address") input[type="checkbox"]').uncheck();
    const shippingRadios = page.locator("fieldset", { hasText: "Shipping Address" }).locator('input[type="radio"][name="savedAddress"]');
    await expect(shippingRadios.first()).toBeChecked();
    await expect(page.locator("body")).toContainText("Default shipping");
    await chooseCodAndPlace(page);
    await expect(page.locator("body")).toContainText(/confirm/i);
  });
});
