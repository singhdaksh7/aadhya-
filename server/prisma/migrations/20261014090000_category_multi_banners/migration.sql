-- AlterTable (additive; legacy desktopBanner/mobileBanner remain and act as banner #1 until `banners` is populated)
ALTER TABLE "Category" ADD COLUMN     "banners" JSONB,
ADD COLUMN     "bannerAutoplay" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "bannerIntervalMs" INTEGER NOT NULL DEFAULT 5000;
