import { test, expect } from "@playwright/test";
test.setTimeout(60000);

const WIDTHS = [390, 768, 1280, 1440];

async function loginCustomer(page) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill("a11ytest@test.local");
  await page.locator('input[type="password"]').fill("TestPassword123!");
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL("**/account", { timeout: 15000 }).catch(() => {});
}

async function loginAdmin(page) {
  await page.goto("/admin/login");
  await page.locator('input[type="email"]').fill("admin@test.local");
  await page.locator('input[type="password"]').fill("TestPassword123!");
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await page.waitForURL("**/admin/**", { timeout: 15000 }).catch(() => {});
}

async function addItemToCart(page) {
  await page.goto("/shop/artisan-ceramic-vase");
  await page.waitForTimeout(1000);
  const addBtn = page.getByRole("button", { name: /add to cart/i }).first();
  if (await addBtn.count()) await addBtn.click();
  await page.waitForTimeout(500);
}

async function checkOverflow(page, label) {
  const result = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  const pass = result.scrollWidth <= result.clientWidth + 1;
  console.log(`${pass ? "PASS" : "FAIL"} overflow | ${label} | scrollWidth=${result.scrollWidth} clientWidth=${result.clientWidth}`);
  return pass;
}

test.describe("Responsive overflow matrix", () => {
  for (const width of WIDTHS) {
    test(`checkout @ ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await loginCustomer(page);
      await addItemToCart(page);
      await page.goto("/checkout");
      await page.waitForTimeout(1500);
      await checkOverflow(page, `Checkout@${width}`);
    });

    test(`account addresses @ ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await loginCustomer(page);
      await page.goto("/account/addresses");
      await page.waitForTimeout(1000);
      await checkOverflow(page, `AccountAddresses@${width}`);
    });

    test(`account orders @ ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await loginCustomer(page);
      await page.goto("/account/orders");
      await page.waitForTimeout(1000);
      await checkOverflow(page, `AccountOrders@${width}`);
    });

    test(`account invoices @ ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await loginCustomer(page);
      await page.goto("/account/invoices");
      await page.waitForTimeout(1000);
      await checkOverflow(page, `AccountInvoices@${width}`);
    });

    test(`admin integrations @ ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await loginAdmin(page);
      await page.goto("/admin/integrations");
      await page.waitForTimeout(1000);
      await checkOverflow(page, `AdminIntegrations@${width}`);
    });

    test(`admin shipping settings @ ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await loginAdmin(page);
      await page.goto("/admin/settings");
      await page.waitForTimeout(500);
      const shippingTab = page.getByRole("button", { name: /shipping rules/i }).first();
      if (await shippingTab.count()) await shippingTab.click();
      await page.waitForTimeout(1000);
      await checkOverflow(page, `AdminShippingSettings@${width}`);
    });

    test(`admin order detail @ ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await loginAdmin(page);
      await page.goto("/admin/orders");
      await page.waitForTimeout(1000);
      const firstOrderLink = page.locator('a[href*="/admin/orders/"]').first();
      if (await firstOrderLink.count()) {
        await firstOrderLink.click();
        await page.waitForTimeout(1000);
        await checkOverflow(page, `AdminOrderDetail@${width}`);
      } else {
        console.log(`SKIP AdminOrderDetail@${width} - no orders exist`);
      }
    });
  }
});

test.describe("Accessibility checks @1280", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("checkout form labels + same-as-shipping checkbox + error association", async ({ page }) => {
    await loginCustomer(page);
    await addItemToCart(page);
    await page.goto("/checkout");
    await page.waitForTimeout(1500);

    // labels (match on the leading "Name" text since the accessible name can
    // absorb a visible error message once one is shown — see below)
    const nameInput = page.getByLabel(/^Name/).first();
    console.log(`${(await nameInput.count()) ? "PASS" : "FAIL"} checkout: Name field has associated label`);

    const sameAsShipping = page.getByLabel(/shipping address is same as billing/i);
    console.log(`${(await sameAsShipping.count()) ? "PASS" : "FAIL"} checkout: same-as-shipping checkbox has accessible label`);

    // trigger validation errors
    await page.getByRole("button", { name: /place order|pay securely/i }).click({ trial: false }).catch(() => {});
    await page.waitForTimeout(500);
    const nameField = page.getByLabel(/^Name/).first();
    const describedBy = await nameField.getAttribute("aria-describedby").catch(() => null);
    const ariaInvalid = await nameField.getAttribute("aria-invalid").catch(() => null);
    console.log(`${describedBy || ariaInvalid ? "PASS" : "FAIL"} checkout: Name field error associated via aria-describedby/aria-invalid (describedby=${describedBy}, invalid=${ariaInvalid})`);

    // keyboard nav
    await page.locator("body").click();
    await page.keyboard.press("Tab");
    const active1 = await page.evaluate(() => document.activeElement.tagName);
    console.log(`INFO checkout: first tab stop tag = ${active1}`);
  });

  test("account addresses form labels", async ({ page }) => {
    await loginCustomer(page);
    await page.goto("/account/addresses");
    await page.waitForTimeout(1000);
    const fields = ["label", "fullName", "phone", "addressLine1", "addressLine2", "city", "state", "postalCode", "country"];
    for (const f of fields) {
      const byPlaceholder = page.locator(`input[placeholder="${f}"]`);
      if (await byPlaceholder.count()) {
        const ariaLabel = await byPlaceholder.first().getAttribute("aria-label");
        const id = await byPlaceholder.first().getAttribute("id");
        console.log(`${ariaLabel || id ? "PASS" : "FAIL"} addresses: field '${f}' has accessible label (aria-label=${ariaLabel}, id=${id})`);
      }
    }
    const defaultCheckbox = page.getByLabel(/set as default shipping address/i);
    console.log(`${(await defaultCheckbox.count()) ? "PASS" : "FAIL"} addresses: default checkbox has accessible label`);
  });

  test("admin integrations secret field labels + test connection feedback", async ({ page }) => {
    await loginAdmin(page);
    await page.goto("/admin/integrations");
    await page.waitForTimeout(1000);
    const keySecret = page.getByLabel(/key secret/i);
    console.log(`${(await keySecret.count()) ? "PASS" : "FAIL"} integrations: Razorpay Key Secret has label`);
    const shipPassword = page.getByLabel(/^password$/i);
    console.log(`${(await shipPassword.count()) ? "PASS" : "FAIL"} integrations: Shiprocket Password has label`);

    const liveRegion = page.locator('[aria-live], [role="status"]');
    console.log(`${(await liveRegion.count()) ? "PASS" : "FAIL"} integrations: a live region exists for status messages (count=${await liveRegion.count()})`);

    const testBtn = page.getByRole("button", { name: /test connection/i });
    if (await testBtn.count()) {
      await testBtn.click();
      await page.waitForTimeout(1000);
      const liveRegion2 = page.locator('[aria-live]:visible, [role="status"]:visible');
      console.log(`${(await liveRegion2.count()) ? "PASS" : "FAIL"} integrations: after Test Connection, visible live region with feedback exists`);
    }
  });

  test("focus visibility spot check on checkout submit button and admin test connection", async ({ page }) => {
    await loginCustomer(page);
    await addItemToCart(page);
    await page.goto("/checkout");
    await page.waitForTimeout(1000);
    const nameInput = page.getByLabel(/^Name/).first();
    await nameInput.focus();
    const style = await nameInput.evaluate((el) => {
      const s = getComputedStyle(el);
      return { outline: s.outlineStyle, outlineWidth: s.outlineWidth, boxShadow: s.boxShadow, borderColor: s.borderColor };
    });
    console.log(`INFO checkout Name focus style: ${JSON.stringify(style)}`);
  });

  test("invoice download control accessible name", async ({ page }) => {
    await loginCustomer(page);
    await page.goto("/account/invoices");
    await page.waitForTimeout(1000);
    const downloadBtns = page.getByRole("button", { name: /download/i });
    console.log(`INFO invoices: ${await downloadBtns.count()} download button(s) found with accessible name`);
  });
});
