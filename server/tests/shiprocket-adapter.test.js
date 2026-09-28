import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import crypto from "node:crypto";
import request from "supertest";
import { createApp } from "../src/app.js";
import { resetDb, seedTestAdmin } from "./helpers.js";
import { prisma } from "../src/lib/prisma.js";
import { getShippingProvider } from "../src/modules/shipping/provider.service.js";
import { buildShipmentPayload, attemptAutomaticShipment } from "../src/modules/shipping/fulfilment.service.js";
import { saveCredential } from "../src/modules/integrations/credential.service.js";
import { env } from "../src/config/env.js";

env.integrationEncryptionKey = env.integrationEncryptionKey || crypto.randomBytes(32).toString("hex");

const app = createApp();

const CREDS = { apiEmail: "shipper@example.com", apiPassword: "super-secret", webhookSecret: "wh-secret-123" };

async function saveShiprocketCreds(overrides = {}) {
  const admin = await seedTestAdmin();
  await saveCredential("SHIPROCKET", "LIVE", { ...CREDS, ...overrides }, admin.id);
}

function jsonResponse(body, { ok = true, status = ok ? 200 : 400 } = {}) {
  return { ok, status, json: async () => body };
}

const originalFetch = global.fetch;

beforeEach(async () => {
  await resetDb();
  await prisma.integrationCredential.deleteMany();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
  global.fetch = originalFetch;
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("Shiprocket adapter: authentication", () => {
  it("logs in successfully and proceeds to call the target endpoint", async () => {
    await saveShiprocketCreds();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ token: "tok-123" }))
      .mockResolvedValueOnce(jsonResponse({ status_code: 200, data: [] }));
    global.fetch = fetchMock;

    const provider = getShippingProvider("SHIPROCKET");
    await provider.testConnection({ environment: "LIVE" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const loginCall = fetchMock.mock.calls[0];
    expect(loginCall[0]).toMatch(/auth\/login$/);
    const loginBody = JSON.parse(loginCall[1].body);
    expect(loginBody).toEqual({ email: CREDS.apiEmail, password: CREDS.apiPassword });
    const dataCall = fetchMock.mock.calls[1];
    expect(dataCall[1].headers.authorization).toBe("Bearer tok-123");
  });

  it("surfaces a clear error and does not crash on invalid credentials (401)", async () => {
    await saveShiprocketCreds();
    global.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ message: "Invalid Email or Password." }, { ok: false, status: 401 }));

    const provider = getShippingProvider("SHIPROCKET");
    await expect(provider.testConnection({ environment: "LIVE" })).rejects.toThrow(/Invalid Email or Password/);
  });

  it("throws a clear error when Shiprocket is not configured at all", async () => {
    const provider = getShippingProvider("SHIPROCKET");
    await expect(provider.testConnection({ environment: "LIVE" })).rejects.toThrow(/not configured/i);
  });
});

describe("Shiprocket adapter: test connection admin action", () => {
  async function getAdminToken() {
    await seedTestAdmin();
    const res = await request(app).post("/api/admin/auth/login").send({
      email: (await import("../src/config/env.js")).env.admin.email,
      password: (await import("../src/config/env.js")).env.admin.password,
    });
    return res.body.data.accessToken;
  }

  it("marks the credential test as SUCCESS when the provider connection check succeeds", async () => {
    await saveShiprocketCreds();
    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ token: "tok-abc" }))
      .mockResolvedValueOnce(jsonResponse({ status_code: 200 }));
    const token = await getAdminToken();

    const res = await request(app)
      .post("/api/admin/integrations/SHIPROCKET/LIVE/test")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.testStatus).toBe("SUCCESS");
  });

  it("marks the credential test as FAILED when the provider connection check fails", async () => {
    await saveShiprocketCreds();
    global.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ message: "bad creds" }, { ok: false, status: 401 }));
    const token = await getAdminToken();

    const res = await request(app)
      .post("/api/admin/integrations/SHIPROCKET/LIVE/test")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.testStatus).toBe("FAILED");
  });
});

const baseSettings = {
  provider: "SHIPROCKET",
  environment: "LIVE",
  pickup: { location: "Primary Warehouse" },
  packageDefaults: { weight: 1.2, length: 25, width: 18, height: 12 },
  courierCompanyId: "51",
};

describe("Shiprocket adapter: order creation", () => {
  it("sends a correctly-shaped payload and handles the success response, including AWB assignment", async () => {
    await saveShiprocketCreds();
    const provider = getShippingProvider("SHIPROCKET");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ token: "tok-1" })) // login for createShipment
      .mockResolvedValueOnce(jsonResponse({ order_id: 555, shipment_id: 999, status_code: 1 })) // create order
      .mockResolvedValueOnce(jsonResponse({ token: "tok-2" })) // login for awb assign
      .mockResolvedValueOnce(jsonResponse({ response: { data: { awb_code: "AWB123", courier_name: "Delhivery" } }, status_code: 1 })); // awb
    global.fetch = fetchMock;

    const input = {
      order: { number: "ORD-1001", date: new Date("2026-01-01"), paymentMethod: "cod" },
      customer: { name: "Jane Doe", email: "jane@example.com", phone: "9998887777" },
      shippingAddress: { fullName: "Jane Doe", addressLine1: "1 Park Ave", city: "Mumbai", state: "Maharashtra", postalCode: "400001", country: "India", phone: "9998887777", email: "jane@example.com" },
      billingAddress: { fullName: "Jane Doe", addressLine1: "1 Park Ave", city: "Mumbai", state: "Maharashtra", postalCode: "400001", country: "India", phone: "9998887777", email: "jane@example.com" },
      items: [{ name: "The Great Book", sku: "BOOK-1", quantity: 2, sellingPrice: 300 }],
      package: { length: 25, width: 18, height: 12, weight: 1.2 },
    };

    const result = await provider.createShipment({ input, settings: baseSettings });

    const createOrderCall = fetchMock.mock.calls[1];
    expect(createOrderCall[0]).toMatch(/orders\/create\/adhoc$/);
    const payload = JSON.parse(createOrderCall[1].body);
    expect(payload.order_id).toBe("ORD-1001");
    expect(payload.billing_customer_name).toBe("Jane Doe");
    expect(payload.shipping_pincode).toBe("400001");
    expect(payload.payment_method).toBe("COD");
    expect(payload.order_items).toEqual([
      expect.objectContaining({ name: "The Great Book", sku: "BOOK-1", units: 2, selling_price: 300 }),
    ]);
    expect(payload.length).toBe(25);
    expect(payload.weight).toBe(1.2);
    expect(payload.pickup_location).toBe("Primary Warehouse");

    expect(result.provider).toBe("SHIPROCKET");
    expect(result.providerShipmentId).toBe("999");
    expect(result.awb).toBe("AWB123");
    expect(result.carrier).toBe("Delhivery");
    expect(result.status).toBe("CREATED");
  });

  it("propagates a clear error when order creation fails upstream", async () => {
    await saveShiprocketCreds();
    const provider = getShippingProvider("SHIPROCKET");
    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ token: "tok-1" }))
      .mockResolvedValueOnce(jsonResponse({ message: "Pickup location not found" }, { ok: false, status: 422 }));

    const input = {
      order: { number: "ORD-2", date: new Date(), paymentMethod: "prepaid" },
      customer: { name: "A", email: "a@example.com", phone: "111" },
      shippingAddress: { fullName: "A", city: "X", state: "Y", postalCode: "1", country: "India", phone: "111" },
      items: [{ name: "Item", sku: "SKU", quantity: 1, sellingPrice: 10 }],
      package: { length: 1, width: 1, height: 1, weight: 1 },
    };

    await expect(provider.createShipment({ input, settings: { ...baseSettings, courierCompanyId: null } }))
      .rejects.toThrow(/Pickup location not found/);
  });
});

describe("Shiprocket adapter: AWB generation", () => {
  it("generates an AWB successfully", async () => {
    await saveShiprocketCreds();
    const provider = getShippingProvider("SHIPROCKET");
    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ token: "tok" }))
      .mockResolvedValueOnce(jsonResponse({ response: { data: { awb_code: "AWB999", courier_name: "BlueDart" } } }));

    const result = await provider.generateAwb({ providerShipmentId: "999" }, baseSettings);
    expect(result.awb).toBe("AWB999");
    expect(result.carrier).toBe("BlueDart");
  });

  it("requires a courier company to be configured before generating an AWB", async () => {
    const provider = getShippingProvider("SHIPROCKET");
    await expect(provider.generateAwb({ providerShipmentId: "999" }, { ...baseSettings, courierCompanyId: null }))
      .rejects.toThrow(/courier company/i);
  });

  it("surfaces a retry-able failure without crashing when AWB assignment fails", async () => {
    await saveShiprocketCreds();
    const provider = getShippingProvider("SHIPROCKET");
    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ token: "tok" }))
      .mockResolvedValueOnce(jsonResponse({ message: "No serviceable courier found" }, { ok: false, status: 400 }));

    await expect(provider.generateAwb({ providerShipmentId: "999" }, baseSettings)).rejects.toThrow(/No serviceable courier found/);
  });
});

describe("Shiprocket adapter: pickup scheduling", () => {
  it("schedules a pickup successfully", async () => {
    await saveShiprocketCreds();
    const provider = getShippingProvider("SHIPROCKET");
    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ token: "tok" }))
      .mockResolvedValueOnce(jsonResponse({ pickup_status: "PICKUP_SCHEDULED" }));

    const result = await provider.schedulePickup({ providerShipmentId: "999" }, baseSettings);
    expect(result.supported).toBe(true);
    expect(result.pickupStatus).toBe("PICKUP_SCHEDULED");
  });

  it("surfaces a clear error when pickup scheduling fails", async () => {
    await saveShiprocketCreds();
    const provider = getShippingProvider("SHIPROCKET");
    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ token: "tok" }))
      .mockResolvedValueOnce(jsonResponse({ message: "Pickup slot unavailable" }, { ok: false, status: 400 }));

    await expect(provider.schedulePickup({ providerShipmentId: "999" }, baseSettings)).rejects.toThrow(/Pickup slot unavailable/);
  });
});

describe("Shiprocket adapter: label generation", () => {
  it("retrieves a generated label URL", async () => {
    await saveShiprocketCreds();
    const provider = getShippingProvider("SHIPROCKET");
    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ token: "tok" }))
      .mockResolvedValueOnce(jsonResponse({ label_url: "https://labels.example/999.pdf" }));

    const result = await provider.getLabel({ providerShipmentId: "999" }, baseSettings);
    expect(result.label_url).toBe("https://labels.example/999.pdf");
  });
});

describe("Shiprocket adapter: tracking", () => {
  it("fetches and normalizes tracking data", async () => {
    await saveShiprocketCreds();
    const provider = getShippingProvider("SHIPROCKET");
    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ token: "tok" }))
      .mockResolvedValueOnce(jsonResponse({ tracking_data: { shipment_status: "in_transit", shipment_track: [{ awb_code: "AWB1" }] } }));

    const result = await provider.getTracking({ providerShipmentId: "999", awb: "AWB1" }, baseSettings);
    expect(result.rawStatus).toBe("in_transit");
    expect(result.trackingNumber).toBe("AWB1");
  });
});

describe("Shiprocket adapter: cancellation", () => {
  it("cancels a shipment successfully", async () => {
    await saveShiprocketCreds();
    const provider = getShippingProvider("SHIPROCKET");
    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ token: "tok" }))
      .mockResolvedValueOnce(jsonResponse({ status_code: 1 }));

    const result = await provider.cancelShipment({ providerShipmentId: "999" }, baseSettings);
    expect(result.cancelled).toBe(true);
  });

  it("surfaces a clear error when cancellation fails", async () => {
    await saveShiprocketCreds();
    const provider = getShippingProvider("SHIPROCKET");
    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ token: "tok" }))
      .mockResolvedValueOnce(jsonResponse({ message: "Shipment already delivered" }, { ok: false, status: 400 }));

    await expect(provider.cancelShipment({ providerShipmentId: "999" }, baseSettings)).rejects.toThrow(/already delivered/);
  });
});

describe("Shiprocket adapter: webhook signature verification (unit)", () => {
  const secret = "wh-secret-123";
  const rawPayload = Buffer.from(JSON.stringify({ status: "delivered" }));

  it("accepts a valid signature", () => {
    const provider = getShippingProvider("SHIPROCKET");
    const signature = crypto.createHmac("sha256", secret).update(rawPayload).digest("hex");
    expect(provider.verifyWebhook(rawPayload, signature, secret)).toBe(true);
  });

  it("rejects an invalid signature", () => {
    const provider = getShippingProvider("SHIPROCKET");
    expect(provider.verifyWebhook(rawPayload, "deadbeef", secret)).toBe(false);
  });

  it("rejects when signature or secret is missing", () => {
    const provider = getShippingProvider("SHIPROCKET");
    expect(provider.verifyWebhook(rawPayload, null, secret)).toBe(false);
    expect(provider.verifyWebhook(rawPayload, "abc", null)).toBe(false);
  });
});

describe("Shiprocket webhook endpoint: end-to-end signature + idempotency", () => {
  async function seedShipmentOrder() {
    const category = await prisma.category.create({ data: { name: "Cat", slug: `cat-${Math.random().toString(36).slice(2)}` } });
    const product = await prisma.product.create({ data: { name: "Book", slug: `book-${Math.random().toString(36).slice(2)}`, productType: "BOOK", categoryId: category.id, price: 300, stockQuantity: 10 } });
    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-${Math.random().toString(36).slice(2, 8)}`,
        accessTokenHash: crypto.randomBytes(16).toString("hex"),
        customerName: "Jane Doe", customerEmail: "jane@example.com", customerPhone: "9998887777",
        status: "PROCESSING", paymentMethod: "prepaid", paymentStatus: "PAID",
        subtotal: 300, shippingAmount: 0, totalAmount: 300,
        items: { create: [{ productId: product.id, productNameSnapshot: "Book", productSlugSnapshot: product.slug, productTypeSnapshot: "BOOK", quantity: 1, unitPrice: 300, lineTotal: 300, bookFormatSnapshot: "PHYSICAL" }] },
      },
    });
    const shipment = await prisma.shipment.create({ data: { orderId: order.id, provider: "SHIPROCKET", providerShipmentId: "999", status: "CREATED" } });
    return { order, shipment };
  }

  it("accepts a webhook with a valid signature and applies the tracking update", async () => {
    await saveShiprocketCreds();
    const { shipment } = await seedShipmentOrder();
    const payload = { eventId: "evt-1", providerShipmentId: shipment.providerShipmentId, status: "delivered", awb: "AWB1" };
    const raw = JSON.stringify(payload);
    const signature = crypto.createHmac("sha256", CREDS.webhookSecret).update(raw).digest("hex");

    const res = await request(app)
      .post("/api/webhooks/shipping/SHIPROCKET")
      .set("Content-Type", "application/json")
      .set("x-shipping-signature", signature)
      .send(raw);

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);

    const updated = await prisma.shipment.findUnique({ where: { id: shipment.id } });
    expect(updated.status).toBe("DELIVERED");
  });

  it("rejects a webhook with an invalid signature", async () => {
    await saveShiprocketCreds();
    const { shipment } = await seedShipmentOrder();
    const payload = { eventId: "evt-2", providerShipmentId: shipment.providerShipmentId, status: "delivered" };
    const raw = JSON.stringify(payload);

    const res = await request(app)
      .post("/api/webhooks/shipping/SHIPROCKET")
      .set("Content-Type", "application/json")
      .set("x-shipping-signature", "totally-wrong-signature-value")
      .send(raw);

    expect(res.status).toBe(401);

    const unchanged = await prisma.shipment.findUnique({ where: { id: shipment.id } });
    expect(unchanged.status).toBe("CREATED");
  });

  it("does not cause duplicate side effects when the same webhook payload is replayed", async () => {
    await saveShiprocketCreds();
    const { shipment, order } = await seedShipmentOrder();
    const payload = { eventId: "evt-replay", providerShipmentId: shipment.providerShipmentId, status: "delivered", awb: "AWB1" };
    const raw = JSON.stringify(payload);
    const signature = crypto.createHmac("sha256", CREDS.webhookSecret).update(raw).digest("hex");

    const first = await request(app)
      .post("/api/webhooks/shipping/SHIPROCKET")
      .set("Content-Type", "application/json")
      .set("x-shipping-signature", signature)
      .send(raw);
    expect(first.status).toBe(200);
    expect(first.body.duplicate).toBeUndefined();

    const second = await request(app)
      .post("/api/webhooks/shipping/SHIPROCKET")
      .set("Content-Type", "application/json")
      .set("x-shipping-signature", signature)
      .send(raw);
    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);

    const events = await prisma.webhookEvent.count({ where: { eventId: "evt-replay" } });
    expect(events).toBe(1);

    const finalOrder = await prisma.order.findUnique({ where: { id: order.id } });
    expect(finalOrder.status).toBe("DELIVERED"); // set once on first apply; the replay must not re-run side effects
  });
});

describe("buildShipmentPayload: outbound payload mapping", () => {
  const settings = {
    packageDefaults: { weight: 2.5, length: 30, width: 20, height: 15 },
    pickup: { location: "Warehouse A", city: "Delhi" },
  };

  async function seedMixedOrder() {
    const category = await prisma.category.create({ data: { name: "Cat", slug: `cat-${Math.random().toString(36).slice(2)}` } });
    const product = await prisma.product.create({ data: { name: "Book", slug: `book-${Math.random().toString(36).slice(2)}`, productType: "BOOK", categoryId: category.id, price: 300, stockQuantity: 10 } });
    const order = await prisma.order.create({
      data: {
        orderNumber: "ORD-MIX-1",
        accessTokenHash: crypto.randomBytes(16).toString("hex"),
        customerName: "Jane Doe", customerEmail: "jane@example.com", customerPhone: "9998887777", customerAlternatePhone: "8887776666",
        status: "CONFIRMED", paymentMethod: "cod", paymentStatus: "PENDING",
        subtotal: 550, shippingAmount: 0, totalAmount: 550,
        address: { create: { fullName: "Jane Doe", phone: "9998887777", addressLine1: "1 Park Ave", city: "Mumbai", state: "Maharashtra", postalCode: "400001", country: "India" } },
        billingAddress: { create: { fullName: "Jane Doe", phone: "9998887777", addressLine1: "1 Park Ave", city: "Mumbai", state: "Maharashtra", postalCode: "400001", country: "India" } },
        items: {
          create: [
            { productId: product.id, productNameSnapshot: "Physical Book", productSlugSnapshot: product.slug, productTypeSnapshot: "BOOK", variantSkuSnapshot: "BOOK-PHY-1", quantity: 1, unitPrice: 400, lineTotal: 400, bookFormatSnapshot: "PHYSICAL" },
            { productId: product.id, productNameSnapshot: "Digital Book (PDF)", productSlugSnapshot: product.slug, productTypeSnapshot: "BOOK", variantSkuSnapshot: "BOOK-PDF-1", quantity: 1, unitPrice: 150, lineTotal: 150, bookFormatSnapshot: "PDF" },
          ],
        },
      },
      include: { items: true, address: true, billingAddress: true },
    });
    return order;
  }

  it("excludes digital/PDF line items and includes only physical items", async () => {
    const order = await seedMixedOrder();
    const payload = buildShipmentPayload(order, settings);

    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].sku).toBe("BOOK-PHY-1");
    expect(payload.items.some((i) => i.sku === "BOOK-PDF-1")).toBe(false);
  });

  it("maps order number, customer details, addresses, package and pickup correctly", async () => {
    const order = await seedMixedOrder();
    const payload = buildShipmentPayload(order, settings);

    expect(payload.order.number).toBe("ORD-MIX-1");
    expect(payload.customer.name).toBe("Jane Doe");
    expect(payload.customer.phone).toBe("9998887777");
    expect(payload.customer.email).toBe("jane@example.com");
    expect(payload.shippingAddress.city).toBe("Mumbai");
    expect(payload.billingAddress.city).toBe("Mumbai");
    expect(payload.package).toEqual(settings.packageDefaults);
    expect(payload.pickup).toEqual(settings.pickup);
  });

  it("sets codAmount to the order total for COD and 0 for prepaid", async () => {
    const codOrder = await seedMixedOrder();
    const codPayload = buildShipmentPayload(codOrder, settings);
    expect(codPayload.order.codAmount).toBe(550);

    const prepaidOrder = await prisma.order.update({
      where: { id: codOrder.id },
      data: { paymentMethod: "prepaid" },
      include: { items: true, address: true, billingAddress: true },
    });
    const prepaidPayload = buildShipmentPayload(prepaidOrder, settings);
    expect(prepaidPayload.order.codAmount).toBe(0);
  });

  it("falls back to default package dimensions when settings don't provide packageDefaults", async () => {
    const order = await seedMixedOrder();
    const payload = buildShipmentPayload(order, {});
    expect(payload.package).toEqual({ weight: 0.5, length: 20, width: 15, height: 10 });
  });
});

describe("attemptAutomaticShipment: end-to-end with mocked Shiprocket HTTP", () => {
  async function seedPhysicalOrder() {
    const category = await prisma.category.create({ data: { name: "Cat", slug: `cat-${Math.random().toString(36).slice(2)}` } });
    const product = await prisma.product.create({ data: { name: "Book", slug: `book-${Math.random().toString(36).slice(2)}`, productType: "BOOK", categoryId: category.id, price: 300, stockQuantity: 10 } });
    return prisma.order.create({
      data: {
        orderNumber: `ORD-AUTO-${Math.random().toString(36).slice(2, 8)}`,
        accessTokenHash: crypto.randomBytes(16).toString("hex"),
        customerName: "Jane Doe", customerEmail: "jane@example.com", customerPhone: "9998887777",
        status: "CONFIRMED", paymentMethod: "prepaid", paymentStatus: "PAID",
        subtotal: 300, shippingAmount: 0, totalAmount: 300,
        address: { create: { fullName: "Jane Doe", phone: "9998887777", addressLine1: "1 Park Ave", city: "Mumbai", state: "Maharashtra", postalCode: "400001", country: "India" } },
        items: { create: [{ productId: product.id, productNameSnapshot: "Book", productSlugSnapshot: product.slug, productTypeSnapshot: "BOOK", variantSkuSnapshot: "SKU-1", quantity: 1, unitPrice: 300, lineTotal: 300, bookFormatSnapshot: "PHYSICAL" }] },
      },
    });
  }

  it("creates a shipment automatically via Shiprocket when autoCreateShipment is enabled", async () => {
    await saveShiprocketCreds();
    await prisma.siteSetting.upsert({
      where: { key: "shippingBusiness" },
      create: { key: "shippingBusiness", value: { provider: "SHIPROCKET", environment: "LIVE", autoCreateShipment: true, pickup: { location: "Primary" }, packageDefaults: { weight: 1, length: 20, width: 15, height: 10 } } },
      update: { value: { provider: "SHIPROCKET", environment: "LIVE", autoCreateShipment: true, pickup: { location: "Primary" }, packageDefaults: { weight: 1, length: 20, width: 15, height: 10 } } },
    });
    const order = await seedPhysicalOrder();

    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ token: "tok" }))
      .mockResolvedValueOnce(jsonResponse({ order_id: 1, shipment_id: 2 }));

    const shipment = await attemptAutomaticShipment(order.id);
    expect(shipment.status).toBe("CREATED");
    expect(shipment.provider).toBe("SHIPROCKET");
    expect(shipment.providerShipmentId).toBe("2");
  });

  it("marks the shipment as CREATION_FAILED without crashing when Shiprocket order creation fails", async () => {
    await saveShiprocketCreds();
    await prisma.siteSetting.upsert({
      where: { key: "shippingBusiness" },
      create: { key: "shippingBusiness", value: { provider: "SHIPROCKET", environment: "LIVE", autoCreateShipment: true, pickup: { location: "Primary" }, packageDefaults: { weight: 1, length: 20, width: 15, height: 10 } } },
      update: { value: { provider: "SHIPROCKET", environment: "LIVE", autoCreateShipment: true, pickup: { location: "Primary" }, packageDefaults: { weight: 1, length: 20, width: 15, height: 10 } } },
    });
    const order = await seedPhysicalOrder();

    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ token: "tok" }))
      .mockResolvedValueOnce(jsonResponse({ message: "Pickup location not found" }, { ok: false, status: 422 }));

    const shipment = await attemptAutomaticShipment(order.id);
    expect(shipment.status).toBe("CREATION_FAILED");
    expect(shipment.lastError).toBeTruthy();
  });
});
