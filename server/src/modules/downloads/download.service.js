import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { generateToken, hashToken, safeCompareHex } from "../../utils/secureToken.js";
import { readPdfStream, pdfExists } from "../uploads/storage.js";

// Creates a DigitalDownload entitlement for a PDF OrderItem, ONLY after
// payment succeeds, and ONLY once per OrderItem — idempotent so a webhook
// retry (or the client-side verify racing the webhook) never mints a second
// token / resets the download counter. orderItemId is @unique on
// DigitalDownload, so this is a safe check-then-create under the payment
// finalize transaction's row lock.
export async function ensureDigitalDownloadForOrderItem(tx, orderItem, order) {
  if (orderItem.bookFormatSnapshot !== "PDF") return null;

  const existing = await tx.digitalDownload.findUnique({ where: { orderItemId: orderItem.id } });
  if (existing) return existing;

  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);

  let expiresAt = null;
  let maxDownloads = null;
  if (orderItem.productId) {
    const option = await tx.bookFormatOption.findUnique({ where: { productId_format: { productId: orderItem.productId, format: "PDF" } } });
    if (option?.expiryDays) expiresAt = new Date(Date.now() + option.expiryDays * 24 * 60 * 60 * 1000);
    if (option?.maxDownloads) maxDownloads = option.maxDownloads;
  }

  await tx.digitalDownload.create({
    data: {
      orderItemId: orderItem.id,
      customerId: order.customerId || null,
      tokenHash,
      maxDownloads,
      expiresAt,
    },
  });

  return { rawToken };
}

function isExpired(entitlement) {
  return entitlement.expiresAt && entitlement.expiresAt.getTime() < Date.now();
}

function isExhausted(entitlement) {
  return entitlement.maxDownloads != null && entitlement.downloadCount >= entitlement.maxDownloads;
}

export async function getDownloadEntitlementStatus(orderItemId) {
  const entitlement = await prisma.digitalDownload.findUnique({ where: { orderItemId } });
  if (!entitlement) return null;
  return {
    downloadCount: entitlement.downloadCount,
    maxDownloads: entitlement.maxDownloads,
    expiresAt: entitlement.expiresAt,
    expired: isExpired(entitlement),
    exhausted: isExhausted(entitlement),
  };
}

// GET /api/downloads/:token — validates the token hash, order payment
// status, entitlement state (active/not expired/count < max), and that the
// backing file actually exists — then returns everything the route handler
// needs to stream it. The storage key/path itself never leaves this module.
export async function resolveDownload(token) {
  const tokenHash = hashToken(token);
  const entitlement = await prisma.digitalDownload.findFirst({ where: { tokenHash } });
  if (!entitlement || !safeCompareHex(hashToken(token), entitlement.tokenHash)) {
    throw ApiError.notFound("Download not found");
  }

  const orderItem = await prisma.orderItem.findUnique({ where: { id: entitlement.orderItemId }, include: { order: true } });
  if (!orderItem) throw ApiError.notFound("Download not found");

  if (orderItem.order.paymentStatus !== "PAID") {
    throw ApiError.forbidden("This order has not been paid for.");
  }
  if (isExpired(entitlement)) {
    throw ApiError.forbidden("This download link has expired.");
  }
  if (isExhausted(entitlement)) {
    throw ApiError.forbidden("The maximum number of downloads has been reached for this item.");
  }

  const pdfKey = orderItem.productId
    ? (await prisma.bookFormatOption.findUnique({ where: { productId_format: { productId: orderItem.productId, format: "PDF" } } }))?.pdfFileKey
    : null;

  if (!pdfKey || !(await pdfExists(pdfKey))) {
    throw ApiError.notFound("The file for this download is no longer available.");
  }

  const file = await readPdfStream(pdfKey);
  if (!file) throw ApiError.notFound("The file for this download is no longer available.");

  await prisma.digitalDownload.update({
    where: { id: entitlement.id },
    data: { downloadCount: { increment: 1 }, lastDownloadedAt: new Date() },
  });

  const filename = orderItem.bookFormatPdfNameSnapshot || `${orderItem.productNameSnapshot || "download"}.pdf`;
  return { stream: file.stream, size: file.size, filename };
}

// GET /account/downloads — lists this customer's digital entitlements.
export async function listCustomerDownloads(customerId) {
  const entitlements = await prisma.digitalDownload.findMany({
    where: { customerId },
    include: { orderItem: { include: { order: true } } },
    orderBy: { createdAt: "desc" },
  });

  return entitlements.map((e) => ({
    orderItemId: e.orderItemId,
    orderNumber: e.orderItem.order.orderNumber,
    productTitle: e.orderItem.productNameSnapshot,
    pdfFilename: e.orderItem.bookFormatPdfNameSnapshot,
    downloadCount: e.downloadCount,
    maxDownloads: e.maxDownloads,
    expiresAt: e.expiresAt,
    expired: isExpired(e),
    exhausted: isExhausted(e),
    paymentStatus: e.orderItem.order.paymentStatus,
  }));
}

// The raw download token is never persisted (only its hash), and it's
// generated during payment finalization where there's no HTTP response to
// hand it back on. So the "Download" button calls this first to mint a
// fresh single-use link on demand — it rotates tokenHash, which also means
// a previously-shared link stops working, which is a feature, not a bug.
async function reissueLink(entitlement) {
  if (!entitlement) throw ApiError.notFound("Download not found");
  if (isExpired(entitlement)) throw ApiError.forbidden("This download has expired.");
  if (isExhausted(entitlement)) throw ApiError.forbidden("The maximum number of downloads has been reached.");

  const rawToken = generateToken();
  await prisma.digitalDownload.update({ where: { id: entitlement.id }, data: { tokenHash: hashToken(rawToken) } });
  return rawToken;
}

export async function reissueCustomerDownloadLink(customerId, orderItemId) {
  const entitlement = await prisma.digitalDownload.findFirst({ where: { orderItemId, customerId } });
  return reissueLink(entitlement);
}

export async function reissueGuestDownloadLink(orderNumber, accessToken, orderItemId) {
  const order = await prisma.order.findUnique({ where: { orderNumber } });
  if (!order || !safeCompareHex(hashToken(accessToken), order.accessTokenHash)) throw ApiError.notFound("Order not found");
  const entitlement = await prisma.digitalDownload.findFirst({ where: { orderItemId, orderItem: { orderId: order.id } } });
  return reissueLink(entitlement);
}

// Guest access: reuses the order's existing accessToken mechanism. Given a
// valid (orderNumber, accessToken) pair, list only that order's digital
// entitlements — no separate guest-download-token system invented.
export async function listGuestOrderDownloads(orderNumber, accessToken) {
  const order = await prisma.order.findUnique({ where: { orderNumber }, include: { items: true } });
  if (!order) throw ApiError.notFound("Order not found");
  if (!safeCompareHex(hashToken(accessToken), order.accessTokenHash)) throw ApiError.notFound("Order not found");

  const itemIds = order.items.map((i) => i.id);
  const entitlements = await prisma.digitalDownload.findMany({ where: { orderItemId: { in: itemIds } } });
  const byItemId = new Map(entitlements.map((e) => [e.orderItemId, e]));

  return order.items
    .filter((i) => i.bookFormatSnapshot === "PDF")
    .map((i) => {
      const e = byItemId.get(i.id);
      return {
        productTitle: i.productNameSnapshot,
        pdfFilename: i.bookFormatPdfNameSnapshot,
        downloadCount: e?.downloadCount ?? 0,
        maxDownloads: e?.maxDownloads ?? null,
        expiresAt: e?.expiresAt ?? null,
        expired: e ? isExpired(e) : false,
        exhausted: e ? isExhausted(e) : false,
        paymentStatus: order.paymentStatus,
      };
    });
}
