import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

const app = createApp();
const request = supertest(app);

describe("Coupon Engine (Phase D)", () => {
  let categoryId = "";
  let subcategoryId = "";
  let eligibleProduct = null;
  let ineligibleProduct = null;
  let couponPercentageId = "";
  let couponFixedId = "";
  let couponExpiredId = "";
  let couponFutureId = "";

  beforeAll(async () => {
    // Setup test categories
    const parentCat = await prisma.category.create({
      data: { name: "Coupon Parent Cat", slug: "coupon-parent-cat-" + Date.now() },
    });
    categoryId = parentCat.id;

    const childCat = await prisma.category.create({
      data: { name: "Coupon Child SubCat", slug: "coupon-child-cat-" + Date.now(), parentId: categoryId },
    });
    subcategoryId = childCat.id;

    // Setup test products
    eligibleProduct = await prisma.product.create({
      data: {
        name: "Eligible Brass Lamp",
        slug: "eligible-brass-lamp-" + Date.now(),
        productType: "PHYSICAL",
        categoryId: subcategoryId, // in descendant category!
        price: 2000,
        mrp: 2500,
        stockQuantity: 50,
        isActive: true,
      },
    });

    ineligibleProduct = await prisma.product.create({
      data: {
        name: "Ineligible Cotton Mat",
        slug: "ineligible-cotton-mat-" + Date.now(),
        productType: "PHYSICAL",
        categoryId: (await prisma.category.create({ data: { name: "Other Cat", slug: "other-cat-" + Date.now() } })).id,
        price: 500,
        stockQuantity: 50,
        isActive: true,
      },
    });

    // Create test coupons
    const c1 = await prisma.coupon.create({
      data: {
        code: "TEST10PCT",
        name: "10% Discount",
        discountType: "PERCENTAGE",
        value: 10,
        minimumOrderAmount: 1000,
        maximumDiscountAmount: 150,
        isActive: true,
      },
    });
    couponPercentageId = c1.id;

    const c2 = await prisma.coupon.create({
      data: {
        code: "TEST300FIXED",
        name: "₹300 Off",
        discountType: "FIXED",
        value: 300,
        minimumOrderAmount: 500,
        isActive: true,
      },
    });
    couponFixedId = c2.id;

    const c3 = await prisma.coupon.create({
      data: {
        code: "EXPIRED100",
        name: "Expired Coupon",
        discountType: "FIXED",
        value: 100,
        validUntil: new Date(Date.now() - 3600000), // 1 hour ago
        isActive: true,
      },
    });
    couponExpiredId = c3.id;

    const c4 = await prisma.coupon.create({
      data: {
        code: "FUTURE100",
        name: "Future Coupon",
        discountType: "FIXED",
        value: 100,
        validFrom: new Date(Date.now() + 3600000), // 1 hour from now
        isActive: true,
      },
    });
    couponFutureId = c4.id;

    // Category target coupon targeting parent category
    await prisma.coupon.create({
      data: {
        code: "PARENTDEF20",
        name: "Parent Cat Coupon",
        discountType: "PERCENTAGE",
        value: 20,
        targetType: "CATEGORY",
        isActive: true,
        targets: {
          create: [{ targetId: categoryId }],
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.couponRedemption.deleteMany({});
    await prisma.couponTarget.deleteMany({});
    await prisma.coupon.deleteMany({ where: { code: { contains: "TEST" } } });
    await prisma.coupon.deleteMany({ where: { code: { in: ["EXPIRED100", "FUTURE100", "PARENTDEF20"] } } });
    await prisma.product.deleteMany({ where: { id: { in: [eligibleProduct.id, ineligibleProduct.id] } } });
    await prisma.category.deleteMany({ where: { id: { in: [categoryId, subcategoryId] } } });
  });

  it("should validate a valid percentage coupon and respect max discount cap", async () => {
    const res = await request.post("/api/coupons/validate").send({
      code: "test10pct", // case-insensitive input!
      items: [{ slug: eligibleProduct.slug, quantity: 1 }], // subtotal = 2000
    });

    expect(res.status).toBe(200);
    expect(res.body.data.code).toBe("TEST10PCT");
    expect(res.body.data.subtotalBeforeDiscount).toBe(2000);
    // 10% of 2000 = 200, but cap = 150 -> discount = 150
    expect(res.body.data.discountAmount).toBe(150);
    expect(res.body.data.subtotalAfterDiscount).toBe(1850);
  });

  it("should validate a valid fixed coupon and calculate totals correctly", async () => {
    const res = await request.post("/api/coupons/validate").send({
      code: "TEST300FIXED",
      items: [{ slug: eligibleProduct.slug, quantity: 1 }], // subtotal = 2000
    });

    expect(res.status).toBe(200);
    expect(res.body.data.discountAmount).toBe(300);
    expect(res.body.data.subtotalAfterDiscount).toBe(1700);
  });

  it("should reject expired coupon", async () => {
    const res = await request.post("/api/coupons/validate").send({
      code: "EXPIRED100",
      items: [{ slug: eligibleProduct.slug, quantity: 1 }],
    });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/expired/i);
  });

  it("should reject future/upcoming coupon", async () => {
    const res = await request.post("/api/coupons/validate").send({
      code: "FUTURE100",
      items: [{ slug: eligibleProduct.slug, quantity: 1 }],
    });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/not active yet/i);
  });

  it("should reject coupon when minimum order amount is not met", async () => {
    const res = await request.post("/api/coupons/validate").send({
      code: "TEST10PCT", // min order = 1000
      items: [{ slug: ineligibleProduct.slug, quantity: 1 }], // price = 500
    });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/minimum order/i);
  });

  it("should validate category target coupon including descendant subcategories", async () => {
    // Coupon targets parent category, product is in subcategory
    const res = await request.post("/api/coupons/validate").send({
      code: "PARENTDEF20",
      items: [
        { slug: eligibleProduct.slug, quantity: 1 }, // eligible! (2000)
        { slug: ineligibleProduct.slug, quantity: 1 }, // ineligible! (500)
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body.data.eligibleSubtotal).toBe(2000);
    // 20% of 2000 = 400 discount
    expect(res.body.data.discountAmount).toBe(400);
    expect(res.body.data.subtotalBeforeDiscount).toBe(2500);
    expect(res.body.data.subtotalAfterDiscount).toBe(2100);
  });

  it("should snapshot coupon and discountAmount on order creation", async () => {
    const res = await request.post("/api/orders").send({
      customer: { name: "Coupon Buyer", email: "buyer@test.com", phone: "9876543210" },
      shippingAddress: {
        fullName: "Coupon Buyer",
        phone: "9876543210",
        addressLine1: "123 Test St",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
      },
      items: [{ slug: eligibleProduct.slug, quantity: 1 }],
      couponCode: "TEST300FIXED",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.orderNumber).toBeDefined();

    const order = await prisma.order.findUnique({ where: { id: res.body.data.orderId } });
    expect(order.couponCode).toBe("TEST300FIXED");
    expect(Number(order.discountAmount)).toBe(300);
    expect(Number(order.subtotal)).toBe(2000);
    expect(Number(order.totalAmount)).toBe(1700); // 2000 - 300
  });

  it("should idempotently record redemption and increment usage count on payment completion", async () => {
    // Create order with coupon
    const orderRes = await request.post("/api/orders").send({
      customer: { name: "Redemption Buyer", email: "redemption@test.com", phone: "9876543210" },
      shippingAddress: {
        fullName: "Redemption Buyer",
        phone: "9876543210",
        addressLine1: "123 Test St",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
      },
      items: [{ slug: eligibleProduct.slug, quantity: 1 }],
      couponCode: "TEST300FIXED",
    });

    const orderId = orderRes.body.data.orderId;
    const initialCoupon = await prisma.coupon.findUnique({ where: { id: couponFixedId } });
    const initialUsage = initialCoupon.usageCount;

    // Import finalizePaidPayment directly to test idempotency
    const { finalizePaidPayment } = await import("../src/modules/payments/payment.service.js");
    const payment = await prisma.payment.findFirst({ where: { orderId } });
    await prisma.payment.update({ where: { id: payment.id }, data: { providerOrderId: "order_mock_123" } });

    // Call 1: finalize payment
    const res1 = await finalizePaidPayment({
      providerOrderId: "order_mock_123",
      providerPaymentId: "pay_mock_123",
      method: "card",
    });
    expect(res1.alreadyProcessed).toBe(false);

    const couponAfter1 = await prisma.coupon.findUnique({ where: { id: couponFixedId } });
    expect(couponAfter1.usageCount).toBe(initialUsage + 1);

    const redemptions1 = await prisma.couponRedemption.findMany({ where: { orderId } });
    expect(redemptions1).toHaveLength(1);

    // Call 2: duplicate webhook/call -> must be idempotent no-op!
    const res2 = await finalizePaidPayment({
      providerOrderId: "order_mock_123",
      providerPaymentId: "pay_mock_123",
      method: "card",
    });
    expect(res2.alreadyProcessed).toBe(true);

    const couponAfter2 = await prisma.coupon.findUnique({ where: { id: couponFixedId } });
    expect(couponAfter2.usageCount).toBe(initialUsage + 1); // Usage count unchanged!
    const redemptions2 = await prisma.couponRedemption.findMany({ where: { orderId } });
    expect(redemptions2).toHaveLength(1); // Redemption count unchanged!
  });
});
