-- CreateEnum
CREATE TYPE "TaxPricingMode" AS ENUM ('TAX_INCLUSIVE', 'TAX_EXCLUSIVE');

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "cgstAmount" DECIMAL(10,2),
ADD COLUMN     "gstRateSnapshot" DECIMAL(4,2),
ADD COLUMN     "hsnCodeSnapshot" TEXT,
ADD COLUMN     "igstAmount" DECIMAL(10,2),
ADD COLUMN     "sgstAmount" DECIMAL(10,2),
ADD COLUMN     "taxableValueSnapshot" DECIMAL(10,2),
ADD COLUMN     "unitSnapshot" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "gstRate" DECIMAL(4,2),
ADD COLUMN     "hsnCode" TEXT,
ADD COLUMN     "invoiceName" TEXT,
ADD COLUMN     "taxPricingMode" "TaxPricingMode" NOT NULL DEFAULT 'TAX_EXCLUSIVE',
ADD COLUMN     "unit" TEXT NOT NULL DEFAULT 'PCS';

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "gstRate" DECIMAL(4,2),
ADD COLUMN     "hsnCode" TEXT,
ADD COLUMN     "unit" TEXT;
