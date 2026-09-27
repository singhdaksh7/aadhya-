// Review-approval notification: server/src/modules/notifications has a full
// customer notification API (list / mark-read / mark-all-read), but this
// branch has no /account/notifications page in the frontend (checked
// src/App.jsx — no route mounts it), so there is nothing to drive through
// the browser for this flow. tests/e2e/admin-storefront-roundtrip.spec.js
// already covers the customer review -> admin moderation -> published pipeline
// through the UI. This spec closes the remaining gap: it proves that
// approving a review actually creates a notification for that customer,
// verified against the real notification API with the customer's own
// access token.
import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@aadyasociety.example";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "ChangeThisPassword123!";
const API_URL = process.env.E2E_API_URL || "http://localhost:4100/api";

const RUN_ID = Date.now();
const CUSTOMER_EMAIL = `e2e_notif_${RUN_ID}@example.com`;
const CUSTOMER_PASS = "TestPassword123!";

test("approving a customer's review creates a notification visible via the notifications API", async ({ request }) => {
  const reg = await request.post(`${API_URL}/auth/register`, {
    data: { name: "E2E Notif Tester", email: CUSTOMER_EMAIL, password: CUSTOMER_PASS },
  });
  expect(reg.ok()).toBeTruthy();
  const customerToken = (await reg.json()).data.accessToken;

  const productsRes = await request.get(`${API_URL}/products?search=Slow%20Living`);
  const products = (await productsRes.json()).data || [];
  expect(products.length).toBeGreaterThan(0);
  const product = products[0];

  const reviewRes = await request.post(`${API_URL}/account/reviews`, {
    headers: { Authorization: `Bearer ${customerToken}` },
    data: { productId: product.id, rating: 5, title: `E2E notif review ${RUN_ID}`, comment: "Great demo book for testing." },
  });
  expect(reviewRes.ok()).toBeTruthy();
  const review = (await reviewRes.json()).data;

  const adminLoginRes = await request.post(`${API_URL}/admin/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(adminLoginRes.ok()).toBeTruthy();
  const adminToken = (await adminLoginRes.json()).data.accessToken;

  const approveRes = await request.patch(`${API_URL}/admin/reviews/${review.id}/status`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { status: "APPROVED" },
  });
  expect(approveRes.ok()).toBeTruthy();

  const notifRes = await request.get(`${API_URL}/account/notifications`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  expect(notifRes.ok()).toBeTruthy();
  const notifBody = await notifRes.json();
  const notifications = notifBody.data || [];
  expect(notifications.length).toBeGreaterThan(0);
  expect(notifBody.meta?.unreadCount).toBeGreaterThan(0);
});
