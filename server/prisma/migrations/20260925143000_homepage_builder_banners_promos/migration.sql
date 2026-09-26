-- CreateEnum
CREATE TYPE "PageType" AS ENUM ('HOME', 'STANDARD', 'LANDING');

-- CreateEnum
CREATE TYPE "PageStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "BannerPlacement" AS ENUM ('HOME_HERO', 'HOME_PROMO', 'SHOP_TOP', 'CATEGORY_TOP', 'GLOBAL_PROMO');

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "pageType" "PageType" NOT NULL DEFAULT 'STANDARD',
    "status" "PageStatus" NOT NULL DEFAULT 'DRAFT',
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageSection" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "settings" JSONB,
    "content" JSONB,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Banner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "placement" "BannerPlacement" NOT NULL DEFAULT 'HOME_HERO',
    "desktopImage" TEXT NOT NULL,
    "mobileImage" TEXT,
    "eyebrow" TEXT,
    "title" TEXT NOT NULL,
    "highlightText" TEXT,
    "subtitle" TEXT,
    "primaryCtaLabel" TEXT,
    "primaryCtaUrl" TEXT,
    "secondaryCtaLabel" TEXT,
    "secondaryCtaUrl" TEXT,
    "textPosition" TEXT NOT NULL DEFAULT 'LEFT',
    "textTheme" TEXT NOT NULL DEFAULT 'DARK',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoMessage" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "couponCode" TEXT,
    "ctaLabel" TEXT,
    "ctaUrl" TEXT,
    "icon" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Page_slug_key" ON "Page"("slug");
CREATE INDEX "Page_slug_idx" ON "Page"("slug");
CREATE INDEX "Page_status_idx" ON "Page"("status");

-- CreateIndex
CREATE INDEX "PageSection_pageId_idx" ON "PageSection"("pageId");
CREATE INDEX "PageSection_sortOrder_idx" ON "PageSection"("sortOrder");

-- CreateIndex
CREATE INDEX "Banner_placement_idx" ON "Banner"("placement");
CREATE INDEX "Banner_isActive_idx" ON "Banner"("isActive");
CREATE INDEX "Banner_sortOrder_idx" ON "Banner"("sortOrder");

-- CreateIndex
CREATE INDEX "PromoMessage_isActive_idx" ON "PromoMessage"("isActive");
CREATE INDEX "PromoMessage_sortOrder_idx" ON "PromoMessage"("sortOrder");

-- AddForeignKey
ALTER TABLE "PageSection" ADD CONSTRAINT "PageSection_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
