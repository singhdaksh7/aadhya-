ALTER TABLE "Address" ADD COLUMN "isDefaultBilling" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Address" ADD COLUMN "isDefaultShipping" BOOLEAN NOT NULL DEFAULT false;

-- Preserve the established delivery-default behavior when upgrading an
-- existing customer. Billing intentionally remains opt-in.
UPDATE "Address" SET "isDefaultShipping" = true WHERE "isDefault" = true;

ALTER TABLE "Shipment" ADD COLUMN "providerOrderId" TEXT;
