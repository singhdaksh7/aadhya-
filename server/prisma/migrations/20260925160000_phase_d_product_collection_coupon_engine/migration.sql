-- CreateEnum
CREATE TYPE "CollectionType" AS ENUM ('MANUAL', 'CATEGORY', 'TAG', 'FEATURED', 'BEST_SELLER', 'NEW_ARRIVAL', 'TRENDING', 'PRICE_RANGE');

-- CreateEnum
CREATE TYPE "CouponDiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "CouponTargetType" AS ENUM ('ALL', 'PRODUCT', 'CATEGORY', 'COLLECTION');

-- AlterTable Product
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "brand" TEXT,
ADD COLUMN IF NOT EXISTS "mrp" DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS "costPrice" DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN IF NOT EXISTS "isTrending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "materials" TEXT,
ADD COLUMN IF NOT EXISTS "dimensions" TEXT,
ADD COLUMN IF NOT EXISTS "careInstructions" TEXT,
ADD COLUMN IF NOT EXISTS "whatsIncluded" TEXT,
ADD COLUMN IF NOT EXISTS "shippingInformation" TEXT,
ADD COLUMN IF NOT EXISTS "specifications" JSONB,
ADD COLUMN IF NOT EXISTS "ogImage" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_isTrending_idx" ON "Product"("isTrending");
CREATE INDEX IF NOT EXISTS "Product_sortOrder_idx" ON "Product"("sortOrder");

-- AlterTable Collection
ALTER TABLE "Collection" ADD COLUMN IF NOT EXISTS "desktopBanner" TEXT,
ADD COLUMN IF NOT EXISTS "mobileBanner" TEXT,
ADD COLUMN IF NOT EXISTS "type" "CollectionType" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN IF NOT EXISTS "ruleConfig" JSONB,
ADD COLUMN IF NOT EXISTS "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "seoTitle" TEXT,
ADD COLUMN IF NOT EXISTS "seoDescription" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Collection_type_idx" ON "Collection"("type");
CREATE INDEX IF NOT EXISTS "Collection_isFeatured_idx" ON "Collection"("isFeatured");
CREATE INDEX IF NOT EXISTS "Collection_sortOrder_idx" ON "Collection"("sortOrder");

-- AlterTable Order
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "couponCode" TEXT,
ADD COLUMN IF NOT EXISTS "couponId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_couponCode_idx" ON "Order"("couponCode");

-- AlterTable PromoMessage
ALTER TABLE "PromoMessage" ADD COLUMN IF NOT EXISTS "couponId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PromoMessage_couponId_idx" ON "PromoMessage"("couponId");

-- CreateTable Coupon
CREATE TABLE IF NOT EXISTS "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "discountType" "CouponDiscountType" NOT NULL DEFAULT 'PERCENTAGE',
    "value" DECIMAL(10,2) NOT NULL,
    "minimumOrderAmount" DECIMAL(10,2),
    "maximumDiscountAmount" DECIMAL(10,2),
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "usageLimit" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "perCustomerLimit" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "targetType" "CouponTargetType" NOT NULL DEFAULT 'ALL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable CouponTarget
CREATE TABLE IF NOT EXISTS "CouponTarget" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable CouponRedemption
CREATE TABLE IF NOT EXISTS "CouponRedemption" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "customerId" TEXT,
    "customerEmail" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "discountAmount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX IF NOT EXISTS "Coupon_code_key" ON "Coupon"("code");
CREATE INDEX IF NOT EXISTS "Coupon_code_idx" ON "Coupon"("code");
CREATE INDEX IF NOT EXISTS "Coupon_isActive_idx" ON "Coupon"("isActive");
CREATE INDEX IF NOT EXISTS "Coupon_validFrom_validUntil_idx" ON "Coupon"("validFrom", "validUntil");

CREATE UNIQUE INDEX IF NOT EXISTS "CouponTarget_couponId_targetId_key" ON "CouponTarget"("couponId", "targetId");
CREATE INDEX IF NOT EXISTS "CouponTarget_couponId_idx" ON "CouponTarget"("couponId");
CREATE INDEX IF NOT EXISTS "CouponTarget_targetId_idx" ON "CouponTarget"("targetId");

CREATE UNIQUE INDEX IF NOT EXISTS "CouponRedemption_orderId_key" ON "CouponRedemption"("orderId");
CREATE INDEX IF NOT EXISTS "CouponRedemption_couponId_idx" ON "CouponRedemption"("couponId");
CREATE INDEX IF NOT EXISTS "CouponRedemption_customerId_idx" ON "CouponRedemption"("customerId");
CREATE INDEX IF NOT EXISTS "CouponRedemption_customerEmail_idx" ON "CouponRedemption"("customerEmail");

-- Foreign Keys
ALTER TABLE "PromoMessage" ADD CONSTRAINT "PromoMessage_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CouponTarget" ADD CONSTRAINT "CouponTarget_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
