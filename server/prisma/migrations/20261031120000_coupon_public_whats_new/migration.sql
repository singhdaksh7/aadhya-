-- Additive only: nothing is dropped or rewritten. Existing coupons stay private (isPublic = false).
ALTER TABLE "Coupon" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Coupon" ADD COLUMN "displayTitle" TEXT;
ALTER TABLE "Coupon" ADD COLUMN "terms" TEXT;
CREATE INDEX "Coupon_isPublic_isActive_idx" ON "Coupon"("isPublic", "isActive");

CREATE TABLE "WhatsNewItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "imageUrl" TEXT,
    "badge" TEXT,
    "ctaLabel" TEXT,
    "ctaUrl" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsNewItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WhatsNewItem_isActive_sortOrder_idx" ON "WhatsNewItem"("isActive", "sortOrder");
CREATE INDEX "WhatsNewItem_startDate_endDate_idx" ON "WhatsNewItem"("startDate", "endDate");
