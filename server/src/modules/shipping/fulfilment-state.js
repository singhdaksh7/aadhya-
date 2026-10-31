import { prisma } from "../../lib/prisma.js";
import { getCredential } from "../integrations/credential.service.js";
import { validatePackage } from "./package-calc.js";

const TERMINAL = new Set(["DELIVERED", "CANCELLED", "RTO_DELIVERED"]);
const RETRYABLE = new Set(["FAILED", "CREATION_FAILED", "CANCELLED"]);
const PICKUP_DONE = new Set(["PICKUP_SCHEDULED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED_ATTEMPT", "RTO", "RTO_DELIVERED"]);
const CANCELLABLE = new Set(["CREATED", "PICKUP_SCHEDULED"]);

// Shiprocket needs a complete, deliverable address. Returns the human-readable problems (empty = fine).
export function validateShippingAddress(address) {
  const problems = [];
  if (!address) return ["The order has no shipping address."];
  if (!String(address.fullName || "").trim()) problems.push("recipient name");
  if (!/^[6-9]\d{9}$/.test(String(address.phone || "").replace(/\D/g, "").slice(-10))) problems.push("a valid 10-digit phone number");
  if (!String(address.addressLine1 || "").trim()) problems.push("address line 1");
  if (!String(address.city || "").trim()) problems.push("city");
  if (!String(address.state || "").trim()) problems.push("state");
  if (!/^\d{6}$/.test(String(address.postalCode || "").trim())) problems.push("a 6-digit pincode");
  return problems.length ? [`Shipping address is missing or invalid: ${problems.join(", ")}.`] : [];
}

export async function isShiprocketConfigured() {
  for (const env of ["LIVE", "TEST"]) {
    const cred = await getCredential("SHIPROCKET", env).catch(() => null);
    if (cred?.data?.apiEmail && cred.data.apiPassword) return true;
  }
  return false;
}

const STEPS = ["NOT_CREATED", "PACKAGE_CONFIRMED", "SHIPMENT_CREATED", "AWB_ASSIGNED", "PICKUP_SCHEDULED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"];

// The single source of truth for which fulfilment actions are valid right now. The UI renders only these and
// the services re-check the same rules, so a stale page cannot trigger an invalid call.
export async function getFulfilmentState(orderId) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, address: true, shipment: true, shipmentPackage: true } });
  if (!order) return null;
  const settingsRow = await prisma.siteSetting.findUnique({ where: { key: "shippingBusiness" } });
  const settings = settingsRow?.value || {};
  const provider = settings.provider || "MANUAL";
  const blockers = [];
  const physical = order.items.some((i) => i.bookFormatSnapshot !== "PDF");
  if (!physical) blockers.push("Digital-only order: nothing to ship.");
  const isShiprocket = provider === "SHIPROCKET";
  const configured = isShiprocket ? await isShiprocketConfigured() : false;
  if (isShiprocket && !configured) blockers.push("Shiprocket API credentials are not configured (Admin → Integrations).");
  if (isShiprocket && !/^\d{6}$/.test(String(settings.pickup?.postalCode || "").trim())) blockers.push("Pickup postal code is not set (Admin → Shipping).");
  const addressProblems = validateShippingAddress(order.address);
  blockers.push(...addressProblems);

  const pkg = order.shipmentPackage;
  const pkgValid = !!pkg && validatePackage(pkg).length === 0;
  const sh = order.shipment;
  const status = sh?.status || null;
  const live = !!sh?.providerShipmentId && !RETRYABLE.has(status);
  const base = isShiprocket && configured && physical;

  let step = "NOT_CREATED";
  if (pkgValid) step = "PACKAGE_CONFIRMED";
  if (live) step = "SHIPMENT_CREATED";
  if (live && sh.awb) step = "AWB_ASSIGNED";
  if (live && status === "PICKUP_SCHEDULED") step = "PICKUP_SCHEDULED";
  if (["PICKED_UP", "IN_TRANSIT"].includes(status)) step = "IN_TRANSIT";
  if (status === "OUT_FOR_DELIVERY") step = "OUT_FOR_DELIVERY";
  if (status === "DELIVERED") step = "DELIVERED";

  const ready = base && addressProblems.length === 0;
  return {
    provider,
    step,
    steps: STEPS,
    blockers,
    shipmentStatus: status,
    actions: {
      confirmPackage: isShiprocket && physical && !pkg?.lockedAt && !live,
      // Also valid after creation while no AWB exists yet, so the Admin can pick a courier for the AWB step.
      checkServiceability: ready && pkgValid && (!live || !sh?.awb) && !TERMINAL.has(status),
      createShipment: ready && pkgValid && (!sh || RETRYABLE.has(status)),
      assignAwb: base && live && !sh.awb && !TERMINAL.has(status),
      schedulePickup: base && live && !!sh.awb && !PICKUP_DONE.has(status),
      cancelShipment: base && live && CANCELLABLE.has(status),
      downloadLabel: base && live && !!sh.awb,
      refreshTracking: base && live,
    },
  };
}
