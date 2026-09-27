-- Phase D: Book physical/PDF/BOTH fulfilment
-- Additive only: new enum, two new tables, new nullable columns on
-- CartItem/OrderItem. Nothing existing is dropped or renamed.

-- 1. New enum
CREATE TYPE "BookFormat" AS ENUM ('PHYSICAL', 'PDF');

-- 2. BookFormatOption
CREATE TABLE "BookFormatOption" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "format" "BookFormat" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "salePrice" DECIMAL(10,2),
    "mrp" DECIMAL(10,2),
    "sku" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "stockQuantity" INTEGER,
    "trackInventory" BOOLEAN,
    "lowStockThreshold" INTEGER,
    "weightGrams" INTEGER,
    "pdfFileKey" TEXT,
    "pdfOriginalName" TEXT,
    "maxDownloads" INTEGER,
    "expiryDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookFormatOption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookFormatOption_productId_format_key" ON "BookFormatOption"("productId", "format");
CREATE INDEX "BookFormatOption_productId_idx" ON "BookFormatOption"("productId");

ALTER TABLE "BookFormatOption" ADD CONSTRAINT "BookFormatOption_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. DigitalDownload
CREATE TABLE "DigitalDownload" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "customerId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "maxDownloads" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "lastDownloadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DigitalDownload_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DigitalDownload_orderItemId_key" ON "DigitalDownload"("orderItemId");
CREATE UNIQUE INDEX "DigitalDownload_tokenHash_key" ON "DigitalDownload"("tokenHash");
CREATE INDEX "DigitalDownload_customerId_idx" ON "DigitalDownload"("customerId");
CREATE INDEX "DigitalDownload_tokenHash_idx" ON "DigitalDownload"("tokenHash");

ALTER TABLE "DigitalDownload" ADD CONSTRAINT "DigitalDownload_orderItemId_fkey"
    FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. CartItem: bookFormat is part of line identity now
ALTER TABLE "CartItem" ADD COLUMN "bookFormat" "BookFormat";
DROP INDEX IF EXISTS "CartItem_cartId_productId_variantId_key";
CREATE UNIQUE INDEX "CartItem_cartId_productId_variantId_bookFormat_key" ON "CartItem"("cartId", "productId", "variantId", "bookFormat");

-- 5. OrderItem: snapshot the selected book format at order time
ALTER TABLE "OrderItem" ADD COLUMN "bookFormatSnapshot" "BookFormat";
ALTER TABLE "OrderItem" ADD COLUMN "bookFormatSkuSnapshot" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "bookFormatPriceSnapshot" DECIMAL(10,2);
ALTER TABLE "OrderItem" ADD COLUMN "bookFormatPdfNameSnapshot" TEXT;
