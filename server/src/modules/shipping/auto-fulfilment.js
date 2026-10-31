import { prisma } from "../../lib/prisma.js";
import { getShippingSettings, getOrderPackageContext, confirmOrderPackage, checkOrderServiceability } from "./package.service.js";
import { getFulfilmentState } from "./fulfilment-state.js";
import { raiseShipmentAlert } from "./shipment-milestones.js";
import { parseEtd } from "./eta.js";

const RETRYABLE = new Set(["FAILED", "CREATION_FAILED", "CANCELLED"]);

// Fully automatic fulfilment for the simple case only: ONE physical product, quantity 1, complete package data.
//   package (auto-confirmed) -> cheapest courier -> Shiprocket order + AWB -> pickup -> customer email
// Anything else (several products, quantities > 1, missing data, no courier, provider trouble) is left for an
// Admin, who confirms or edits the package and picks the courier (the cheapest is preselected). Idempotent:
// an order that already has a live shipment is never touched. Never throws.
export async function autoFulfilOrder(orderId) {
  try {
    const settings = await getShippingSettings();
    if ((settings.provider || "MANUAL") !== "SHIPROCKET" || !settings.autoFulfilSingleItem) return { handled: false };

    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, address: true, shipment: true } });
    if (!order || order.status === "CANCELLED") return { handled: true, outcome: "SKIPPED", reason: "order_not_shippable" };
    if (order.shipment && !RETRYABLE.has(order.shipment.status)) return { handled: true, outcome: "ALREADY_SHIPPING" };
    // A previous automatic attempt failed: do not loop on it. The Admin retries manually from the order.
    if (order.shipment && RETRYABLE.has(order.shipment.status) && order.shipment.status !== "CANCELLED") return { handled: true, outcome: "NEEDS_REVIEW", reason: "previous_attempt_failed" };

    const physical = order.items.filter((i) => i.bookFormatSnapshot !== "PDF");
    if (physical.length !== 1 || physical[0].quantity !== 1) return { handled: true, outcome: "NEEDS_REVIEW", reason: "multiple_items" };

    const ctx = await getOrderPackageContext(orderId);
    const s = ctx.suggestion;
    if (s.source !== "AUTO_SINGLE" || !s.weightKg || !s.lengthCm || !s.widthCm || !s.heightCm) {
      await raiseShipmentAlert("NEEDS_PACKAGE_DETAILS", { orderId, orderNumber: order.orderNumber, detail: "Add weight and package size to this product (Admin → Products → Shipping & Package Details), then ship the order manually." });
      return { handled: true, outcome: "NEEDS_REVIEW", reason: "incomplete_package_data" };
    }

    // Exactly-one-runner lock: Shipment.orderId is unique, so of two concurrent triggers (payment webhook + the
    // browser's verify call) only one gets past this point. The row is released again if we stop for review.
    try {
      await prisma.shipment.create({ data: { orderId, provider: "SHIPROCKET", status: "CREATING" } });
    } catch {
      const existing = await prisma.shipment.findUnique({ where: { orderId } });
      if (existing && !RETRYABLE.has(existing.status)) return { handled: true, outcome: "ALREADY_SHIPPING" };
    }
    const release = () => prisma.shipment.deleteMany({ where: { orderId, status: "CREATING", providerShipmentId: null } });

    const state = await getFulfilmentState(orderId);
    if (state.blockers.length) {
      await release();
      await raiseShipmentAlert("SHIPMENT_CREATION_FAILED", { orderId, orderNumber: order.orderNumber, detail: state.blockers[0] });
      return { handled: true, outcome: "NEEDS_REVIEW", reason: "blocked" };
    }

    await confirmOrderPackage(orderId, { weightKg: s.weightKg, lengthCm: s.lengthCm, widthCm: s.widthCm, heightCm: s.heightCm }, "AUTO");
    const options = await checkOrderServiceability(orderId);
    const cheapest = options.couriers[0];
    if (!cheapest) {
      await release();
      await raiseShipmentAlert("NO_COURIER_AVAILABLE", { orderId, orderNumber: order.orderNumber, detail: `No courier can deliver to ${options.deliveryPostcode}${options.cod ? " with cash on delivery" : ""}.` });
      return { handled: true, outcome: "NEEDS_REVIEW", reason: "no_courier" };
    }

    // Imported lazily: order.service imports fulfilment.service, which imports this module.
    const orders = await import("../orders/order.service.js");
    const fulfil = await import("./fulfilment.service.js");
    let shipment = await orders.createOrderShipment(orderId, { courierCompanyId: cheapest.courierCompanyId, estimatedDelivery: parseEtd(cheapest.etd) || undefined });
    if (!shipment.awb) shipment = await fulfil.generateAwbForShipment(shipment.id, null, { courierCompanyId: cheapest.courierCompanyId });
    shipment = await fulfil.schedulePickupForShipment(shipment.id).catch(() => shipment); // failure alerts itself; Admin can retry
    await fulfil.notifyShipmentBooked(orderId);
    return { handled: true, outcome: "SHIPPED_AUTOMATICALLY", courierCompanyId: cheapest.courierCompanyId, awb: shipment.awb || null };
  } catch (error) {
    await prisma.shipment.deleteMany({ where: { orderId, status: "CREATING", providerShipmentId: null } }).catch(() => {});
    console.error("Automatic fulfilment failed:", error.message);
    return { handled: true, outcome: "FAILED", reason: error.message };
  }
}
