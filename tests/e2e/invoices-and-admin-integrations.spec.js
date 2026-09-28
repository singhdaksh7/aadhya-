// E2E coverage for the customer invoice UI and the admin integrations /
// shipping-business settings screens. Payment/shipping providers are never
// hit for real: COD checkout produces a real, synchronously-confirmed
// invoice (see server/src/modules/orders/order.service.js), and the
// Razorpay/Shiprocket "Test Connection" network calls are intercepted.
import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@test.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "TestPassword123!";
const API_URL = process.env.E2E_API_URL || "http://localhost:4100/api";
const RUN_ID = Date.now();
const PHYSICAL_SLUG = "artisan-ceramic-vase";

async function adminLogin(page) {
  await page.goto("/admin/login");
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.locator('button:has-text("Sign In")').click();
  await expect(page.locator('a:has-text("Products")').first()).toBeVisible();
}

async function registerCustomer(page, email, password, name) {
  await page.goto("/register");
  await page.getByPlaceholder("Name").fill(name);
  await page.locator('input[type="email"]').fill(email);
  await page.getByPlaceholder("password", { exact: false }).first().fill(password);
  await page.locator('button:has-text("Create account")').click();
  await page.waitForURL(/\/account/);
}

async function loginCustomer(page, email, password) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button:has-text("Log in")').click();
  await page.waitForURL(/\/account/);
}

async function placeCodOrder(page, { name, email, phone }) {
  await page.goto("/cart");
  await page.goto(`/shop/${PHYSICAL_SLUG}`);
  await page.locator('button:has-text("Add to Cart")').first().click();
  await page.goto("/checkout");
  await page.getByLabel(/^Name$/).fill(name);
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('[data-testid="contact-phone"]').fill(phone);
  const section = page.locator("fieldset", { hasText: "Billing / Communication Address" });
  await section.getByLabel("Full Name").fill(name);
  await section.getByLabel("Billing email").fill(email);
  await section.locator('[data-testid="address-phone"]').fill(phone);
  await section.getByLabel("Address Line 1").fill("1 Invoice Test Street");
  await section.getByLabel("City").fill("Pune");
  await section.getByLabel("State").fill("MH");
  await section.getByLabel("PIN Code").fill("411001");
  await page.locator('input[name="paymentMethod"][value="cod"]').check();
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/order\/.+\/confirmation/, { timeout: 15000 });
}

test.describe("Customer invoice UI", () => {
  const emailA = `invoice.a.${RUN_ID}@example.com`;
  const emailB = `invoice.b.${RUN_ID}@example.com`;
  const password = "InvoiceTest1234!";

  test("8-9. account invoice listing shows the order and downloads a PDF blob", async ({ page }) => {
    await registerCustomer(page, emailA, password, "Invoice Customer A");
    await placeCodOrder(page, { name: "Invoice Customer A", email: emailA, phone: "9876500030" });

    await page.goto("/account/invoices");
    await expect(page.locator("table")).toContainText("AADYA");

    const downloadPromise = page.waitForEvent("download");
    await page.locator('button:has-text("Download")').first().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    const stream = await download.createReadStream();
    const chunks = [];
    await new Promise((resolve, reject) => {
      stream.on("data", (c) => chunks.push(c));
      stream.on("end", resolve);
      stream.on("error", reject);
    });
    const buffer = Buffer.concat(chunks);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.slice(0, 4).toString()).toBe("%PDF");
  });

  test("10. a customer cannot download another customer's invoice", async ({ page, request }) => {
    await registerCustomer(page, emailB, password, "Invoice Customer B");
    await placeCodOrder(page, { name: "Invoice Customer B", email: emailB, phone: "9876500031" });

    // Grab customer B's own access token from the app, then fetch customer
    // A's invoice id directly against the API — this must be rejected.
    const invoicesB = await page.evaluate(async (apiUrl) => {
      const token = JSON.parse(localStorage.getItem("aadya_customer_token") || sessionStorage.getItem("aadya_customer_token") || "null");
      return token;
    }, API_URL).catch(() => null);

    const loginRes = await request.post(`${API_URL}/auth/login`, { data: { email: emailB, password } });
    const loginBody = await loginRes.json();
    const tokenB = loginBody.data.accessToken || loginBody.data.tokens?.access;

    const loginResA = await request.post(`${API_URL}/auth/login`, { data: { email: emailA, password } });
    const loginBodyA = await loginResA.json();
    const tokenA = loginBodyA.data.accessToken || loginBodyA.data.tokens?.access;

    const invoicesA = await request.get(`${API_URL}/account/invoices`, { headers: { Authorization: `Bearer ${tokenA}` } });
    const invoicesAJson = await invoicesA.json();
    const invoiceAId = invoicesAJson.data[0].id;

    const crossAccess = await request.get(`${API_URL}/account/invoices/${invoiceAId}/download`, { headers: { Authorization: `Bearer ${tokenB}` } });
    expect(crossAccess.status()).toBeGreaterThanOrEqual(400);
    expect(crossAccess.status()).toBeLessThan(500);

    const anonAccess = await request.get(`${API_URL}/account/invoices/${invoiceAId}/download`);
    expect(anonAccess.status()).toBeGreaterThanOrEqual(400);
    expect(anonAccess.status()).toBeLessThan(500);
  });
});

test.describe("Admin integrations & shipping business settings", () => {
  test.describe.configure({ mode: "serial" });

  test("11. Razorpay configuration form saves credentials", async ({ page }) => {
    await adminLogin(page);
    await page.goto("/admin/integrations");
    await expect(page.locator("h1")).toContainText("Integrations");

    const section = page.locator("section", { hasText: "Razorpay" });
    await section.getByLabel("Key ID").fill(`rzp_test_${RUN_ID}`);
    await section.getByLabel("Key Secret").fill(`secret_${RUN_ID}`);
    await section.locator('button:has-text("Save")').click();
    await expect(page.locator("body")).toContainText("Razorpay credentials saved securely.");
  });

  test("12. Shiprocket configuration form saves credentials", async ({ page }) => {
    await adminLogin(page);
    await page.goto("/admin/integrations");
    const section = page.locator("section", { hasText: "Shiprocket" });
    await section.getByLabel("Email / username").fill(`shiprocket.${RUN_ID}@example.com`);
    await section.getByLabel("Password").fill(`ShiprocketPw${RUN_ID}`);
    await section.locator('button:has-text("Replace Credentials")').click();
    await expect(page.locator("body")).toContainText("Shiprocket credentials saved securely.");
  });

  test("13. saved secrets are never rendered in plaintext after reload", async ({ page }) => {
    await adminLogin(page);
    await page.goto("/admin/integrations");
    await expect(page.locator("body")).toContainText("Configured");
    // The credential form fields reset to blank after save/reload, and the
    // status area only ever exposes provider + test status — never the
    // plaintext secret we submitted above.
    await expect(page.locator("body")).not.toContainText(`secret_${RUN_ID}`);
    await expect(page.locator("body")).not.toContainText(`ShiprocketPw${RUN_ID}`);
    const secretInputs = page.locator('input[type="password"]');
    for (const input of await secretInputs.all()) {
      await expect(input).toHaveValue("");
    }
  });

  test("14. Test Connection flow completes against a mocked backend response", async ({ page }) => {
    await adminLogin(page);
    await page.route(`${API_URL}/admin/integrations/SHIPROCKET/TEST/test`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { provider: "SHIPROCKET", environment: "TEST", testStatus: "SUCCESS", lastTestedAt: new Date().toISOString(), configured: true } }),
      })
    );
    await page.route(`${API_URL}/admin/integrations`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { credentials: [{ provider: "SHIPROCKET", environment: "TEST", configured: true, testStatus: "SUCCESS", lastTestedAt: new Date().toISOString() }], webhookUrl: "/api/webhooks/razorpay" } }),
      })
    );
    await page.goto("/admin/integrations");
    await page.locator('button:has-text("Test Connection")').click();
    await expect(page.locator("body")).toContainText("Connection test completed.");
    await expect(page.locator("body")).toContainText(/not tested|SUCCESS/i);
  });

  test("15. shipping business settings save provider, auto-create toggles, and package defaults", async ({ page }) => {
    await adminLogin(page);
    await page.goto("/admin/integrations");
    const section = page.locator("section", { hasText: "Shipping provider" });
    // The form's initial state loads asynchronously (adminGetShippingBusiness);
    // interacting before that resolves would have our selection clobbered
    // when the fetch response lands, so wait for the page to settle first.
    await page.waitForLoadState("networkidle");
    await section.locator("select").first().selectOption("SHIPROCKET");
    await section.locator("select").nth(1).selectOption("TEST");
    await section.locator('label:has-text("Auto-create shipment") input[type="checkbox"]').check();
    await section.locator('label:has-text("Auto-generate AWB") input[type="checkbox"]').check();
    await section.getByLabel("length").fill("25");
    await section.getByLabel("width").fill("18");
    await section.getByLabel("height").fill("12");
    await section.getByLabel("weight").fill("1.2");
    await section.locator('button:has-text("Save shipping settings")').click();
    await expect(page.locator("body")).toContainText("Shipping settings saved.");

    await page.reload();
    const reloaded = page.locator("section", { hasText: "Shipping provider" });
    await expect(reloaded.locator("select").first()).toHaveValue("SHIPROCKET");
    await expect(reloaded.locator('label:has-text("Auto-create shipment") input[type="checkbox"]')).toBeChecked();
  });
});
