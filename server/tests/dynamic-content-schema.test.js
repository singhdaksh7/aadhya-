import { describe, it, expect, vi, beforeEach } from "vitest";

// DB-free tests for the admin-driven content work: Books secondary row config, return policy
// settings, the system-page protection rules and the public-settings privacy filter.

const prismaMock = vi.hoisted(() => ({ page: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() } }));
vi.mock("../src/lib/prisma.js", () => ({ prisma: prismaMock }));

const { settingsValidationSchema, toPublicSettings, DEFAULT_SETTINGS } = await import("../src/modules/settings/settings.routes.js");
const pageService = await import("../src/modules/pages/page.service.js");

const navItem = (extra = {}) => ({ id: "nav-books", label: "Books", enabled: true, destinationType: "BOOKS", destination: "/books", megaMenuMode: "MANUAL", ...extra });
const parseNav = (item) => settingsValidationSchema.safeParse({ header: { primaryNav: { items: [item] } } });

describe("Books secondary row config schema", () => {
  const row = { enabled: true, items: [
    { id: "r1", label: "New Releases", destinationType: "CUSTOM_URL", destination: "/shop/books#new-releases", enabled: true, sortOrder: 1, showDesktop: true, showMobile: true },
    { id: "r2", label: "Slow Living", destinationType: "CATEGORY", categorySlug: "books-slow-living", enabled: true, sortOrder: 2 },
  ] };

  it("accepts and preserves labels, order, destinations and enabled flags", () => {
    const res = parseNav(navItem({ secondaryRow: row }));
    expect(res.success).toBe(true);
    const saved = res.data.header.primaryNav.items[0].secondaryRow;
    expect(saved.items.map((i) => i.label)).toEqual(["New Releases", "Slow Living"]);
    expect(saved.items.map((i) => i.sortOrder)).toEqual([1, 2]);
    expect(saved.items[1].categorySlug).toBe("books-slow-living");
    expect(saved.enabled).toBe(true);
  });

  it("is optional (missing config is valid)", () => {
    expect(parseNav(navItem()).success).toBe(true);
  });

  it("rejects script-capable destinations and oversized rows", () => {
    expect(parseNav(navItem({ secondaryRow: { items: [{ label: "x", destinationType: "CUSTOM_URL", destination: "javascript:alert(1)" }] } })).success).toBe(false);
    const many = Array.from({ length: 13 }, (_, i) => ({ label: `L${i}`, destinationType: "CUSTOM_URL", destination: "/x" }));
    expect(parseNav(navItem({ secondaryRow: { items: many } })).success).toBe(false);
  });
});

describe("return policy + tax display settings", () => {
  it("ships defaults the storefront and the return service can both rely on", () => {
    expect(DEFAULT_SETTINGS.returns).toEqual({ enabled: true, windowDays: 7 });
    expect(DEFAULT_SETTINGS.checkout.pricesIncludeTax).toBe(true);
  });

  it("validates the returns window and rejects nonsense", () => {
    expect(settingsValidationSchema.safeParse({ returns: { enabled: true, windowDays: 14 } }).success).toBe(true);
    expect(settingsValidationSchema.safeParse({ returns: { windowDays: -1 } }).success).toBe(false);
    expect(settingsValidationSchema.safeParse({ returns: { windowDays: 7.5 } }).success).toBe(false);
    expect(settingsValidationSchema.safeParse({ checkout: { pricesIncludeTax: false } }).success).toBe(true);
  });

  it("no longer hardcodes a rupee threshold in default customer-facing copy", () => {
    const copy = JSON.stringify([DEFAULT_SETTINGS.header.utilityBarItems, DEFAULT_SETTINGS.announcementBar]);
    expect(copy).not.toMatch(/2,499|2499/);
    expect(copy).toContain("{freeShippingThreshold}");
  });
});

describe("public settings privacy", () => {
  it("never exposes the invoice settings (GSTIN, PAN, address, bank details)", () => {
    const pub = toPublicSettings({ general: { storeName: "Tushaqsa" }, invoice: { gstin: "X", bankAccountNumber: "123" }, returns: { windowDays: 7 } });
    expect(pub.invoice).toBeUndefined();
    expect(pub.general.storeName).toBe("Tushaqsa");
    expect(pub.returns.windowDays).toBe(7);
  });
});

describe("system page protection", () => {
  beforeEach(() => vi.clearAllMocks());
  const stub = (slug) => prismaMock.page.findUnique.mockResolvedValue({ id: "p1", slug, status: "PUBLISHED", sections: [] });

  it("lists every routed CMS page as protected", () => {
    expect(pageService.SYSTEM_PAGE_SLUGS).toEqual(["about", "shipping", "returns", "privacy", "terms", "cancellation", "payments", "contact", "training", "consultation", "research", "events", "thinkpod", "gifting"]);
  });

  it("refuses to delete a system page", async () => {
    stub("shipping");
    await expect(pageService.deletePage("p1")).rejects.toThrow(/system page/);
    expect(prismaMock.page.delete).not.toHaveBeenCalled();
  });

  it("refuses to change a system page slug but allows editing its content", async () => {
    stub("returns");
    await expect(pageService.updatePage("p1", { slug: "refunds" })).rejects.toThrow(/slug cannot be changed/);
    prismaMock.page.update.mockResolvedValue({ id: "p1" });
    await pageService.updatePage("p1", { content: "<p>New copy</p>", name: "Returns" });
    expect(prismaMock.page.update).toHaveBeenCalled();
  });

  it("still allows deleting an ordinary page", async () => {
    stub("summer-lookbook");
    prismaMock.page.delete.mockResolvedValue({});
    await pageService.deletePage("p1");
    expect(prismaMock.page.delete).toHaveBeenCalled();
  });
});
