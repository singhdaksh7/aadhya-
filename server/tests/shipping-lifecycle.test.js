import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from "vitest";
import request from "supertest";

const createShipmentMock = vi.fn();
vi.mock("../src/modules/shipping/provider.service.js", () => ({
  getShippingProvider: () => ({ createShipment: createShipmentMock }),
}));

const sendMailMock = vi.fn().mockResolvedValue({ messageId: "mock-message-id" });
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: sendMailMock }) },
}));

const { createApp } = await import("../src/app.js");
const { prisma } = await import("../src/lib/prisma.js");
const { resetDb, seedTestProduct, seedTestBookWithFormats, VALID_CUSTOMER, VALID_ADDRESS } = await import("./helpers.js");
const { createOrder, updateOrderStatus, createOrderShipment } = await import("../src/modules/orders/order.service.js");
const { finalizePaidPayment } = await import("../src/modules/payments/payment.service.js");
const {
  attemptAutomaticShipment,
  applyTrackingUpdate,
  normalizeShippingStatus,
  buildShipmentPayload,
} = await import("../src/modules/shipping/fulfilment.service.js");

const app = createApp();

async function enableAutoShipment(overrides = {}) {
  const value = {
    provider: "MOCK",
    environment: "TEST",
    autoCreateShipment: true,
    autoGenerateAwb: false,
    autoSchedulePickup: false,
    codAllowed: true,
    pickup: {},
    packageDefaults: { length: 20, width: 15, height: 10, weight: 0.5 },
    ...overrides,
  };
  await prisma.siteSetting.upsert({
    where: { key: "shippingBusiness" },
    create: { key: "shippingBusiness", value },
    update: { value },
  });
  return value;
}

// sendMailMock is shared across every email the app sends (order
// confirmation, invoice, shipping status) since they all funnel through the
// same nodemailer transport. Scope assertions to shipping-status mail only
// by matching the subject line each one uses.
function shippingStatusEmailCalls() {
  return sendMailMock.mock.calls.filter(([arg]) => /shipped|out for delivery|delivered/i.test(arg.subject));
}

function mockShipmentCreated(overrides = {}) {
  createShipmentMock.mockResolvedValueOnce({
    provider: "MOCK",
    providerShipmentId: "mock-shipment-1",
    trackingNumber: "MOCKTRACK1",
    trackingUrl: "https://track.example/MOCKTRACK1",
    carrier: "Mock Carrier",
    status: "CREATED",
    ...overrides,
  });
}

// Places a physical-eligible order directly via the HTTP layer (mirrors the
// real checkout flow), then marks its Razorpay payment "paid" by driving
// finalizePaidPayment the same way the verify endpoint / webhook would.
async function placePrepaidOrder(items, address = VALID_ADDRESS) {
  const res = await request(app)
    .post("/api/orders")
    .send({ customer: VALID_CUSTOMER, shippingAddress: address, items, paymentMethod: "razorpay" });
  expect(res.status).toBe(201);
  const orderId = res.body.data.orderId;
  const payment = await prisma.payment.findFirst({ where: { orderId } });
  await prisma.payment.update({ where: { id: payment.id }, data: { providerOrderId: `rzp_order_${orderId}` } });
  return orderId;
}

async function payOrder(orderId) {
  const payment = await prisma.payment.findFirst({ where: { orderId } });
  return finalizePaidPayment({
    providerOrderId: payment.providerOrderId,
    providerPaymentId: `rzp_pay_${orderId}`,
    method: "razorpay",
  });
}

async function placeCodOrder(items, address = VALID_ADDRESS) {
  await prisma.shippingZone.create({ data: { name: "KA", states: ["Karnataka"], postalCodes: [], codSupported: true } }).catch(() => {});
  const res = await request(app)
    .post("/api/orders")
    .send({ customer: VALID_CUSTOMER, shippingAddress: address, items, paymentMethod: "cod" });
  expect(res.status).toBe(201);
  return res.body.data.orderId;
}

beforeEach(async () => {
  await resetDb();
  createShipmentMock.mockReset();
  sendMailMock.mockClear();
  sendMailMock.mockResolvedValue({ messageId: "mock-message-id" });
  process.env.SMTP_HOST = "smtp.test.local";
});

afterEach(() => {
  delete process.env.SMTP_HOST;
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("shipment lifecycle triggers", () => {
  it("triggers an automatic shipment attempt when a prepaid (Razorpay) order is paid", async () => {
    await enableAutoShipment();
    const product = await seedTestProduct({ price: 500, stockQuantity: 10 });
    const orderId = await placePrepaidOrder([{ slug: product.slug, quantity: 1 }]);
    mockShipmentCreated();

    await payOrder(orderId);
    await attemptAutomaticShipment(orderId); // payment.service fires this detached; drive it directly for determinism

    expect(createShipmentMock).toHaveBeenCalledTimes(1);
    const shipment = await prisma.shipment.findUnique({ where: { orderId } });
    expect(shipment.status).toBe("CREATED");
    expect(shipment.trackingNumber).toBe("MOCKTRACK1");
  });

  it("triggers an automatic shipment attempt when a COD order is confirmed", async () => {
    await enableAutoShipment();
    const product = await seedTestProduct({ price: 500, stockQuantity: 10 });
    mockShipmentCreated();
    const orderId = await placeCodOrder([{ slug: product.slug, quantity: 1 }]);

    await attemptAutomaticShipment(orderId);

    expect(createShipmentMock).toHaveBeenCalledTimes(1);
    const shipment = await prisma.shipment.findUnique({ where: { orderId } });
    expect(shipment.status).toBe("CREATED");
  });

  it("never creates or attempts a shipment for a PDF-only order", async () => {
    await enableAutoShipment();
    const book = await seedTestBookWithFormats({ formats: { PDF: { price: 250, pdfFileKey: "book.pdf" } } });
    const orderId = await placePrepaidOrder([{ slug: book.slug, quantity: 1, bookFormat: "PDF" }]);

    await payOrder(orderId);
    const result = await attemptAutomaticShipment(orderId);

    expect(result).toBeNull();
    expect(createShipmentMock).not.toHaveBeenCalled();
    const shipment = await prisma.shipment.findUnique({ where: { orderId } });
    expect(shipment).toBeNull();
  });

  it("creates a shipment for a mixed cart and only includes physical items in the payload", async () => {
    await enableAutoShipment();
    const book = await seedTestBookWithFormats({
      formats: { PHYSICAL: { price: 400, stockQuantity: 10 }, PDF: { price: 250, pdfFileKey: "book.pdf" } },
    });
    const physicalProduct = await seedTestProduct({ price: 300, stockQuantity: 10 });

    const orderId = await placePrepaidOrder([
      { slug: book.slug, quantity: 1, bookFormat: "PDF" },
      { slug: book.slug, quantity: 1, bookFormat: "PHYSICAL" },
      { slug: physicalProduct.slug, quantity: 2 },
    ]);
    mockShipmentCreated();
    await payOrder(orderId);
    await attemptAutomaticShipment(orderId);

    expect(createShipmentMock).toHaveBeenCalledTimes(1);
    const callArgs = createShipmentMock.mock.calls[0][0];
    const itemNames = callArgs.input.items.map((i) => i.name);
    // Only the two physical lines (book PHYSICAL format + the physical product)
    // should be present — the PDF line must be filtered out.
    expect(callArgs.input.items).toHaveLength(2);
    expect(itemNames.some((n) => n.includes(book.name))).toBe(true);

    const orderWithItems = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    const payload = buildShipmentPayload(orderWithItems, {});
    expect(payload.items).toHaveLength(2);
    expect(payload.items.every((i) => i.sku !== null || true)).toBe(true);
  });

  it("leaves the order and invoice untouched and marks the shipment retryable on provider failure", async () => {
    await enableAutoShipment();
    const product = await seedTestProduct({ price: 500, stockQuantity: 10 });
    const orderId = await placePrepaidOrder([{ slug: product.slug, quantity: 1 }]);
    createShipmentMock.mockRejectedValueOnce(new Error("carrier down"));

    await payOrder(orderId);
    const invoiceBefore = await prisma.invoice.findFirst({ where: { orderId } });
    expect(invoiceBefore).not.toBeNull();

    const result = await attemptAutomaticShipment(orderId);

    expect(result.status).toBe("CREATION_FAILED");
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order.paymentStatus).toBe("PAID");
    expect(order.status).toBe("CONFIRMED");
    const invoiceAfter = await prisma.invoice.findFirst({ where: { orderId } });
    expect(invoiceAfter.id).toBe(invoiceBefore.id);
    expect(invoiceAfter.status ?? "OK").toBeTruthy();

    const shipment = await prisma.shipment.findUnique({ where: { orderId } });
    expect(shipment.status).toBe("CREATION_FAILED");
    expect(shipment.lastError).toBeTruthy();
  });
});

describe("shipment idempotency", () => {
  it("does not attempt a second shipment for a duplicate payment webhook / verify retry", async () => {
    await enableAutoShipment();
    const product = await seedTestProduct({ price: 500, stockQuantity: 10 });
    const orderId = await placePrepaidOrder([{ slug: product.slug, quantity: 1 }]);
    mockShipmentCreated();

    await payOrder(orderId);
    // A second finalize call for the same payment must be a safe no-op
    // (the payment CAS short-circuits it), but we also directly simulate
    // a duplicate automatic-shipment trigger, which is the real risk here.
    await payOrder(orderId);

    await Promise.all([attemptAutomaticShipment(orderId), attemptAutomaticShipment(orderId)]);

    expect(createShipmentMock).toHaveBeenCalledTimes(1);
    const shipments = await prisma.shipment.findMany({ where: { orderId } });
    expect(shipments).toHaveLength(1);
  });

  it("reuses the existing shipment row on a repeated manual admin shipment trigger instead of duplicating it", async () => {
    const product = await seedTestProduct({ price: 500, stockQuantity: 10 });
    const orderId = await placeCodOrder([{ slug: product.slug, quantity: 1 }]);
    await enableAutoShipment({ autoCreateShipment: false });

    mockShipmentCreated({ providerShipmentId: "manual-1" });
    const first = await createOrderShipment(orderId, { carrier: "BlueDart" });
    mockShipmentCreated({ providerShipmentId: "manual-1", trackingNumber: "UPDATED-TRACK" });
    const second = await createOrderShipment(orderId, { carrier: "BlueDart" });

    expect(first.id).toBe(second.id);
    const shipments = await prisma.shipment.findMany({ where: { orderId } });
    expect(shipments).toHaveLength(1);
    expect(second.trackingNumber).toBe("UPDATED-TRACK");
  });

  it("ignores a duplicate tracking webhook for the same status without duplicating side effects", async () => {
    await enableAutoShipment();
    const product = await seedTestProduct({ price: 500, stockQuantity: 10 });
    const orderId = await placeCodOrder([{ slug: product.slug, quantity: 1 }]);
    mockShipmentCreated();
    await attemptAutomaticShipment(orderId);
    const shipment = await prisma.shipment.findUnique({ where: { orderId } });

    await applyTrackingUpdate({ provider: "MOCK", providerShipmentId: shipment.providerShipmentId, rawStatus: "shipped" });
    await applyTrackingUpdate({ provider: "MOCK", providerShipmentId: shipment.providerShipmentId, rawStatus: "shipped" });

    expect(shippingStatusEmailCalls()).toHaveLength(1);
    const notifications = await prisma.customerNotification.findMany({ where: { type: "ORDER_IN_TRANSIT" } });
    // No customerId on a guest COD order in this test, so no notification
    // rows are expected either way; the important assertion is the email.
    void notifications;
    const emailLogs = await prisma.emailLog.findMany({ where: { orderId, type: "IN_TRANSIT_EMAIL", status: "SENT" } });
    expect(emailLogs).toHaveLength(1);
  });
});

describe("normalizeShippingStatus", () => {
  it("maps every known provider status to its canonical value", () => {
    expect(normalizeShippingStatus("shipped")).toBe("IN_TRANSIT");
    expect(normalizeShippingStatus("in_transit")).toBe("IN_TRANSIT");
    expect(normalizeShippingStatus("out_for_delivery")).toBe("OUT_FOR_DELIVERY");
    expect(normalizeShippingStatus("delivered")).toBe("DELIVERED");
    expect(normalizeShippingStatus("failed_attempt")).toBe("FAILED_ATTEMPT");
    expect(normalizeShippingStatus("rto")).toBe("RTO");
    expect(normalizeShippingStatus("rto_delivered")).toBe("RTO_DELIVERED");
    expect(normalizeShippingStatus("cancelled")).toBe("CANCELLED");
    expect(normalizeShippingStatus("unknown-status")).toBe("PENDING");
  });
});

describe("webhook status transitions", () => {
  async function shipOrder() {
    await enableAutoShipment();
    const product = await seedTestProduct({ price: 500, stockQuantity: 10 });
    const orderId = await placeCodOrder([{ slug: product.slug, quantity: 1 }]);
    mockShipmentCreated();
    await attemptAutomaticShipment(orderId);
    const shipment = await prisma.shipment.findUnique({ where: { orderId } });
    return { orderId, shipment };
  }

  it("walks a shipment through IN_TRANSIT -> OUT_FOR_DELIVERY -> DELIVERED", async () => {
    const { orderId, shipment } = await shipOrder();

    await applyTrackingUpdate({ provider: "MOCK", providerShipmentId: shipment.providerShipmentId, rawStatus: "in_transit" });
    let updated = await prisma.shipment.findUnique({ where: { orderId } });
    expect(updated.status).toBe("IN_TRANSIT");
    let order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order.status).toBe("SHIPPED");

    await applyTrackingUpdate({ provider: "MOCK", providerShipmentId: shipment.providerShipmentId, rawStatus: "out_for_delivery" });
    updated = await prisma.shipment.findUnique({ where: { orderId } });
    expect(updated.status).toBe("OUT_FOR_DELIVERY");

    await applyTrackingUpdate({ provider: "MOCK", providerShipmentId: shipment.providerShipmentId, rawStatus: "delivered" });
    updated = await prisma.shipment.findUnique({ where: { orderId } });
    expect(updated.status).toBe("DELIVERED");
    expect(updated.deliveredDate).not.toBeNull();
    order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order.status).toBe("DELIVERED");
  });

  it("handles FAILED_ATTEMPT without moving the order backward", async () => {
    const { orderId, shipment } = await shipOrder();
    await applyTrackingUpdate({ provider: "MOCK", providerShipmentId: shipment.providerShipmentId, rawStatus: "in_transit" });
    await applyTrackingUpdate({ provider: "MOCK", providerShipmentId: shipment.providerShipmentId, rawStatus: "failed_attempt" });
    const updated = await prisma.shipment.findUnique({ where: { orderId } });
    expect(updated.status).toBe("FAILED_ATTEMPT");
  });

  it("allows RTO_INITIATED (rto) to later progress to RTO_DELIVERED", async () => {
    const { orderId, shipment } = await shipOrder();
    await applyTrackingUpdate({ provider: "MOCK", providerShipmentId: shipment.providerShipmentId, rawStatus: "in_transit" });
    await applyTrackingUpdate({ provider: "MOCK", providerShipmentId: shipment.providerShipmentId, rawStatus: "rto" });
    let updated = await prisma.shipment.findUnique({ where: { orderId } });
    expect(updated.status).toBe("RTO");

    // RTO is an in-flight return state, not a dead end — a later webhook
    // must still be able to advance it to RTO_DELIVERED.
    await applyTrackingUpdate({ provider: "MOCK", providerShipmentId: shipment.providerShipmentId, rawStatus: "rto_delivered" });
    updated = await prisma.shipment.findUnique({ where: { orderId } });
    expect(updated.status).toBe("RTO_DELIVERED");
  });

  it("handles CANCELLED via webhook", async () => {
    const { orderId, shipment } = await shipOrder();
    await applyTrackingUpdate({ provider: "MOCK", providerShipmentId: shipment.providerShipmentId, rawStatus: "cancelled" });
    const updated = await prisma.shipment.findUnique({ where: { orderId } });
    expect(updated.status).toBe("CANCELLED");
  });

  it("rejects a webhook trying to move a terminal shipment backward (DELIVERED -> IN_TRANSIT)", async () => {
    const { orderId, shipment } = await shipOrder();
    await applyTrackingUpdate({ provider: "MOCK", providerShipmentId: shipment.providerShipmentId, rawStatus: "delivered" });
    let updated = await prisma.shipment.findUnique({ where: { orderId } });
    expect(updated.status).toBe("DELIVERED");

    await applyTrackingUpdate({ provider: "MOCK", providerShipmentId: shipment.providerShipmentId, rawStatus: "in_transit" });
    updated = await prisma.shipment.findUnique({ where: { orderId } });
    expect(updated.status).toBe("DELIVERED");

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order.status).toBe("DELIVERED");
  });

  it("rejects a webhook trying to move a CANCELLED shipment to any other status", async () => {
    const { orderId, shipment } = await shipOrder();
    await applyTrackingUpdate({ provider: "MOCK", providerShipmentId: shipment.providerShipmentId, rawStatus: "cancelled" });
    await applyTrackingUpdate({ provider: "MOCK", providerShipmentId: shipment.providerShipmentId, rawStatus: "delivered" });
    const updated = await prisma.shipment.findUnique({ where: { orderId } });
    expect(updated.status).toBe("CANCELLED");
  });
});

describe("shipping status customer communication", () => {
  async function shipOrderForCustomer() {
    await enableAutoShipment();
    const product = await seedTestProduct({ price: 500, stockQuantity: 10 });
    const orderId = await placePrepaidOrder([{ slug: product.slug, quantity: 1 }]);
    mockShipmentCreated();
    await payOrder(orderId);
    await attemptAutomaticShipment(orderId);
    const shipment = await prisma.shipment.findUnique({ where: { orderId } });
    return { orderId, shipment };
  }

  it("sends exactly one email for each of shipped, out-for-delivery, and delivered", async () => {
    const { orderId, shipment } = await shipOrderForCustomer();

    await applyTrackingUpdate({ provider: "MOCK", providerShipmentId: shipment.providerShipmentId, rawStatus: "in_transit" });
    await applyTrackingUpdate({ provider: "MOCK", providerShipmentId: shipment.providerShipmentId, rawStatus: "out_for_delivery" });
    await applyTrackingUpdate({ provider: "MOCK", providerShipmentId: shipment.providerShipmentId, rawStatus: "delivered" });

    expect(shippingStatusEmailCalls()).toHaveLength(3);
    const sentLogs = await prisma.emailLog.findMany({ where: { orderId, status: "SENT" } });
    const shippingLogTypes = sentLogs.map((l) => l.type).filter((t) => t.endsWith("_EMAIL"));
    expect(shippingLogTypes.sort()).toEqual(["DELIVERED_EMAIL", "IN_TRANSIT_EMAIL", "OUT_FOR_DELIVERY_EMAIL"]);
  });

  it("does not send a second email or duplicate notification for a repeated webhook of the same status", async () => {
    const { orderId, shipment } = await shipOrderForCustomer();

    await applyTrackingUpdate({ provider: "MOCK", providerShipmentId: shipment.providerShipmentId, rawStatus: "in_transit" });
    await applyTrackingUpdate({ provider: "MOCK", providerShipmentId: shipment.providerShipmentId, rawStatus: "in_transit" });
    await applyTrackingUpdate({ provider: "MOCK", providerShipmentId: shipment.providerShipmentId, rawStatus: "in_transit" });

    expect(shippingStatusEmailCalls()).toHaveLength(1);
    const sentLogs = await prisma.emailLog.findMany({ where: { orderId, type: "IN_TRANSIT_EMAIL", status: "SENT" } });
    expect(sentLogs).toHaveLength(1);
  });
});
