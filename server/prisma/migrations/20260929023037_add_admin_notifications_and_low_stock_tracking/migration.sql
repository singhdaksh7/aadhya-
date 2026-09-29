-- CreateEnum
CREATE TYPE "AdminNotificationType" AS ENUM ('NEW_ORDER', 'PAYMENT_FAILED', 'LOW_STOCK', 'OUT_OF_STOCK', 'SHIPMENT_FAILED', 'RETURN_REQUESTED', 'REFUND_FAILED', 'EMAIL_FAILED', 'WEBHOOK_FAILED', 'BACKUP_FAILED', 'SYSTEM_WARNING');

-- CreateEnum
CREATE TYPE "AdminNotificationSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- DropIndex
DROP INDEX "CartItem_variantId_idx";

-- AlterTable
ALTER TABLE "PageSection" ALTER COLUMN "name" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "lowStockNotifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "lowStockNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "lowStockThreshold" INTEGER;

-- CreateTable
CREATE TABLE "AdminNotification" (
    "id" TEXT NOT NULL,
    "type" "AdminNotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "AdminNotificationSeverity" NOT NULL DEFAULT 'INFO',
    "entityType" TEXT,
    "entityId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminNotification_isRead_idx" ON "AdminNotification"("isRead");

-- CreateIndex
CREATE INDEX "AdminNotification_type_idx" ON "AdminNotification"("type");

-- CreateIndex
CREATE INDEX "AdminNotification_createdAt_idx" ON "AdminNotification"("createdAt");

-- CreateIndex
CREATE INDEX "AdminNotification_entityType_entityId_idx" ON "AdminNotification"("entityType", "entityId");
