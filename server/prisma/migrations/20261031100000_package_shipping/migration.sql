-- Additive: operational shipping data, order package snapshot, package presets.
ALTER TABLE "Product" ADD COLUMN "shipWeightGrams" INTEGER, ADD COLUMN "shipLengthMm" INTEGER, ADD COLUMN "shipWidthMm" INTEGER, ADD COLUMN "shipHeightMm" INTEGER;
ALTER TABLE "ProductVariant" ADD COLUMN "shipWeightGrams" INTEGER, ADD COLUMN "shipLengthMm" INTEGER, ADD COLUMN "shipWidthMm" INTEGER, ADD COLUMN "shipHeightMm" INTEGER;

CREATE TABLE "OrderShipmentPackage" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "weightGrams" INTEGER NOT NULL,
  "lengthMm" INTEGER NOT NULL,
  "widthMm" INTEGER NOT NULL,
  "heightMm" INTEGER NOT NULL,
  "source" TEXT NOT NULL,
  "presetName" TEXT,
  "itemsSnapshot" JSONB,
  "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedBy" TEXT,
  "lockedAt" TIMESTAMP(3),
  CONSTRAINT "OrderShipmentPackage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrderShipmentPackage_orderId_key" ON "OrderShipmentPackage"("orderId");
ALTER TABLE "OrderShipmentPackage" ADD CONSTRAINT "OrderShipmentPackage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PackagePreset" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "lengthMm" INTEGER NOT NULL,
  "widthMm" INTEGER NOT NULL,
  "heightMm" INTEGER NOT NULL,
  "tareGrams" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PackagePreset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PackagePreset_name_key" ON "PackagePreset"("name");
