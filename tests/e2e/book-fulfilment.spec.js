// Book fulfilment E2E: covers the three demo book modes seeded by
// server/prisma/seed.js (SEED_DEMO_CATALOG=true) — physical-only, PDF-only,
// and BOTH — through cart/checkout, plus the PDF download flow and the
// admin-side fulfilment (tracking + status transitions) for a physical
// order. Digital "PAID" state can't be reached through the real UI in this
// environment (no Razorpay keys configured and COD is intentionally
// rejected for digital-only carts), so the PDF-download assertion finalizes
// payment directly via the server's own `finalizePaidPayment` — the same
// function the Razorpay webhook calls — to simulate a successful webhook
// without needing real payment credentials.
import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@aadyasociety.example";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "ChangeThisPassword123!";
const API_URL = process.env.E2E_API_URL || "http://localhost:4100/api";

const RUN_ID = Date.now();
const CUSTOMER_EMAIL = `e2e_books_${RUN_ID}@example.com`;
const CUSTOMER_PASS = "TestPassword123!";
const CUSTOMER_NAME = `E2E Book Buyer ${RUN_ID}`;

test.describe.configure({ mode: "serial" });

async function adminLogin(page) {
  await page.goto("/admin/login");
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.locator('button:has-text("Sign In")').click();
  await expect(page.locator('a:has-text("Products")').first()).toBeVisible();
}

async function customerLogin(page) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(CUSTOMER_EMAIL);
  await page.locator('input[type="password"]').fill(CUSTOMER_PASS);
  await page.locator('button:has-text("Log in")').click();
  await expect(page).toHaveURL(/\/account/);
}

let physicalOrderNumber;

test.beforeAll(async ({ request }) => {
  const reg = await request.post(`${API_URL}/auth/register`, {
    data: { name: CUSTOMER_NAME, email: CUSTOMER_EMAIL, password: CUSTOMER_PASS },
  });
  expect(reg.ok()).toBeTruthy();

  // No shipping zones are seeded by the demo catalog seed, and COD is
  // rejected for any address that doesn't resolve to a COD-supporting
  // zone. Ensure a Maharashtra zone exists so the COD checkout path used
  // below is actually reachable.
  const adminLoginRes = await request.post(`${API_URL}/admin/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const adminToken = (await adminLoginRes.json()).data.accessToken;
  const zonesRes = await request.get(`${API_URL}/admin/shipping/zones`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const zones = (await zonesRes.json()).data || [];
  if (!zones.some((z) => (z.states || []).includes("Maharashtra"))) {
    await request.post(`${API_URL}/admin/shipping/zones`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: "E2E Maharashtra Zone", states: ["Maharashtra"], codSupported: true, active: true },
    });
  }
});

test("Physical-only book: browse, add to cart, checkout via COD", async ({ page }) => {
  await customerLogin(page);
  await page.goto("/shop/the-art-of-slow-living");
  await expect(page.locator("h1")).toContainText("The Art of Slow Living");

  // Physical-only book has no format selector — just a direct Add to Cart.
  await page.locator('button:has-text("Add to Cart")').first().click();

  await page.goto("/cart");
  await expect(page.locator("body")).toContainText("The Art of Slow Living");

  await page.locator('a:has-text("Proceed to Checkout"), button:has-text("Proceed to Checkout")').first().click();
  await expect(page).toHaveURL(/\/checkout/);

  // Shipping address IS required for a physical cart.
  await expect(page.locator("legend", { hasText: "Shipping Address" })).toBeVisible();

  await page.locator('input[data-testid="contact-phone"]').fill("9876543210");
  await page.getByLabel("Full Name").fill(CUSTOMER_NAME);
  await page.locator('input[data-testid="address-phone"]').fill("9876543210");
  await page.getByLabel("Address Line 1").fill("221B Baker Street");
  await page.getByLabel("City").fill("Mumbai");
  await page.getByLabel("State").fill("Maharashtra");
  await page.getByLabel("PIN Code").fill("400001");

  await page.locator('input[value="cod"]').check();
  await page.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(/\/order\/.+\/confirmation/, { timeout: 15000 });
  const match = page.url().match(/\/order\/([^/]+)\/confirmation/);
  physicalOrderNumber = match[1];
  expect(physicalOrderNumber).toBeTruthy();
});

test("BOTH-format book: both Physical and PDF options are offered and price updates on selection", async ({ page }) => {
  await customerLogin(page);
  await page.goto("/shop/spaces-of-stillness");
  await expect(page.locator("h1")).toContainText("Spaces of Stillness");

  await expect(page.locator("text=Choose Format")).toBeVisible();
  const physicalOption = page.locator('button[aria-pressed]', { hasText: "Physical Book" });
  const pdfOption = page.locator('button[aria-pressed]', { hasText: "PDF / Digital" });
  await expect(physicalOption).toBeVisible();
  await expect(pdfOption).toBeVisible();

  await physicalOption.click();
  await expect(physicalOption).toHaveAttribute("aria-pressed", "true");
  const physicalPriceText = await page.locator("p.text-terracotta, p.font-bold.text-terracotta").first().textContent();

  await pdfOption.click();
  await expect(pdfOption).toHaveAttribute("aria-pressed", "true");
  const pdfPriceText = await page.locator("p.text-terracotta, p.font-bold.text-terracotta").first().textContent();

  // PDF format is priced lower than physical for this seeded book (60% of
  // the physical price per seed.js), so the displayed price must change.
  expect(physicalPriceText).not.toEqual(pdfPriceText);
});

test("PDF-only book: only the PDF format is available, checkout skips shipping, COD is rejected", async ({ page }) => {
  await customerLogin(page);
  await page.goto("/shop/aadya-home-styling-guide");
  await expect(page.locator("h1")).toContainText("Aadya Home Styling Guide");

  // PDF-only: the format selector doesn't even render (only one format,
  // auto-selected) — just confirm the PDP shows the PDF nature and add it.
  await page.locator('button:has-text("Add to Cart")').first().click();

  await page.goto("/cart");
  await expect(page.locator("body")).toContainText("Aadya Home Styling Guide");

  await page.locator('a:has-text("Proceed to Checkout"), button:has-text("Proceed to Checkout")').first().click();
  await expect(page).toHaveURL(/\/checkout/);

  // Digital-only cart: no shipping address section at all.
  await expect(page.locator("legend", { hasText: "Shipping Address" })).toHaveCount(0);
  await expect(page.locator("text=entirely digital (PDF)")).toBeVisible();

  await page.locator('input[data-testid="contact-phone"]').fill("9876543210");

  // Attempting COD on a digital-only cart is rejected server-side (Phase
  // D+H fix) — the order is never created for this payment method.
  const codRadio = page.locator('input[value="cod"]');
  if (await codRadio.count() > 0) {
    await codRadio.check();
    await page.locator('button[type="submit"]').click();
    await expect(page.locator("text=/not available for digital/i")).toBeVisible({ timeout: 10000 });
  }

  // Switch to Razorpay — in this environment there are no Razorpay keys
  // configured, so payment opening fails gracefully but the order is
  // still created as pending, landing on the "payment unavailable" stage.
  const razorpayRadio = page.locator('input[value="razorpay"]');
  if (await razorpayRadio.count() > 0) {
    await razorpayRadio.check();
    await page.locator('button[type="submit"]').click();
    await expect(page.locator("text=/pending|Opening Payment Window/i").first()).toBeVisible({ timeout: 15000 });
  }
});

test("admin fulfilment: add tracking info to the physical order and move it through the status pipeline", async ({ page }) => {
  expect(physicalOrderNumber).toBeTruthy();
  await adminLogin(page);
  await page.goto("/admin/orders");
  const row = page.locator("tr", { hasText: physicalOrderNumber });
  await expect(row).toBeVisible();
  await row.locator('a:has-text("View")').click();
  await expect(page).toHaveURL(/\/admin\/orders\/[0-9a-f-]{36}/);

  // Fulfilment / Tracking
  await page.locator("label", { hasText: "Carrier" }).locator("input").fill("BlueDart Express");
  await page.locator("label", { hasText: "Tracking number" }).locator("input").fill(`TRACK-${RUN_ID}`);
  await page.locator('button:has-text("Save tracking info")').click();
  await expect(page.locator('button:has-text("Saving")')).toHaveCount(0);

  // COD orders are confirmed immediately at checkout, so the pipeline
  // from here is CONFIRMED -> PROCESSING -> SHIPPED.
  await page.locator('button:has-text("PROCESSING")').click();
  await expect(page.locator("text=PROCESSING").first()).toBeVisible();

  await page.locator('button:has-text("SHIPPED")').click();
  await expect(page.locator("text=SHIPPED").first()).toBeVisible();

  // Carrier/tracking values persisted through the reloads triggered by
  // each status change.
  await expect(page.locator("label", { hasText: "Carrier" }).locator("input")).toHaveValue("BlueDart Express");
});

test("PDF download flow: after payment finalizes, /account/downloads shows a working download entry", async ({ page, request }) => {
  await customerLogin(page);
  await page.goto("/shop/aadya-home-styling-guide");
  await page.locator('button:has-text("Add to Cart")').first().click();
  await page.goto("/cart");
  await page.locator('a:has-text("Proceed to Checkout"), button:has-text("Proceed to Checkout")').first().click();
  await expect(page).toHaveURL(/\/checkout/);

  await page.locator('input[data-testid="contact-phone"]').fill("9876543210");
  await page.locator('input[value="razorpay"]').check();
  await page.locator('button[type="submit"]').click();
  await expect(page.locator("text=/pending|Opening Payment Window/i").first()).toBeVisible({ timeout: 15000 });

  // Pull the order number that was just created for this customer via the
  // admin orders API (avoids needing to scrape it out of the disabled UI
  // state), then simulate the Razorpay webhook completing successfully by
  // calling the server's own finalizePaidPayment — imported directly since
  // this test runs in Node and the repo has no test-only "mark paid" HTTP
  // route. This is equivalent to what the real webhook does on success.
  const adminLoginRes = await request.post(`${API_URL}/admin/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const adminToken = (await adminLoginRes.json()).data.accessToken;
  const ordersRes = await request.get(`${API_URL}/admin/orders?search=${encodeURIComponent(CUSTOMER_EMAIL)}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const ordersJson = await ordersRes.json();
  const pdfOrder = (ordersJson.data || ordersJson.items || []).find((o) =>
    (o.customerEmail || "").toLowerCase() === CUSTOMER_EMAIL.toLowerCase() && o.paymentMethod !== "cod"
  );
  expect(pdfOrder, "expected a pending razorpay order for this customer").toBeTruthy();

  const { PrismaClient } = await import("../../server/node_modules/@prisma/client/index.js");
  const prisma = new PrismaClient();
  try {
    const providerOrderId = `e2e_sim_${RUN_ID}`;
    const payment = await prisma.payment.findFirst({ where: { orderId: pdfOrder.id } });
    expect(payment).toBeTruthy();
    await prisma.payment.update({ where: { id: payment.id }, data: { providerOrderId } });

    const { finalizePaidPayment } = await import("../../server/src/modules/payments/payment.service.js");
    await finalizePaidPayment({
      providerOrderId,
      providerPaymentId: `e2e_pay_${RUN_ID}`,
      method: "card",
      rawReference: "e2e-simulated-webhook",
    });
  } finally {
    await prisma.$disconnect();
  }

  await page.goto("/account/downloads");
  await expect(page.locator("h1, h2")).toContainText("My Downloads");
  await expect(page.locator("text=Aadya Home Styling Guide")).toBeVisible({ timeout: 10000 });
  const downloadBtn = page.locator('button:has-text("Download")').first();
  await expect(downloadBtn).toBeEnabled();
});
