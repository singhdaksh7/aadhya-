ALTER TABLE "Order" ADD COLUMN "customerAlternatePhone" TEXT;
ALTER TABLE "OrderAddress" ADD COLUMN "alternatePhone" TEXT, ADD COLUMN "email" TEXT, ADD COLUMN "landmark" TEXT;
ALTER TABLE "OrderBillingAddress" ADD COLUMN "alternatePhone" TEXT, ADD COLUMN "email" TEXT, ADD COLUMN "landmark" TEXT;
