import { prisma } from "./prisma.js";

// Customer-facing store name (payment window, emails) comes from Store Settings -> general.storeName,
// the same value the storefront shows, so no business name is hard-coded in server code.
export async function getStoreName() {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: "general" } });
    const name = row?.value && typeof row.value === "object" ? String(row.value.storeName || "").trim() : "";
    return name || "Tushaqsa";
  } catch {
    return "Tushaqsa";
  }
}
