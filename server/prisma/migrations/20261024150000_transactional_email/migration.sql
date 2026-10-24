-- Additive only: nothing is dropped or rewritten.

-- Out for delivery is a real customer-visible order state (set manually by Admin or by the courier webhook).
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'OUT_FOR_DELIVERY';

-- Status history records who/what changed the status.
ALTER TABLE "OrderStatusHistory" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'SYSTEM';
ALTER TABLE "OrderStatusHistory" ADD COLUMN "adminId" TEXT;
ALTER TABLE "OrderStatusHistory" ADD COLUMN "shipmentId" TEXT;
ALTER TABLE "OrderStatusHistory" ADD COLUMN "providerEventId" TEXT;

-- Email log gains notification metadata (no bodies, no codes, no secrets).
ALTER TABLE "EmailLog" ADD COLUMN "event" TEXT;
ALTER TABLE "EmailLog" ADD COLUMN "subject" TEXT;
ALTER TABLE "EmailLog" ADD COLUMN "source" TEXT;
ALTER TABLE "EmailLog" ADD COLUMN "notificationId" TEXT;

-- At-most-once notification ledger.
CREATE TABLE "NotificationEvent" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "orderId" TEXT,
    "customerId" TEXT,
    "recipient" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "providerEventId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationEvent_dedupeKey_key" ON "NotificationEvent"("dedupeKey");
CREATE INDEX "NotificationEvent_orderId_idx" ON "NotificationEvent"("orderId");
CREATE INDEX "NotificationEvent_status_nextRetryAt_idx" ON "NotificationEvent"("status", "nextRetryAt");

-- Admin-editable email wording.
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "heading" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailTemplate_key_key" ON "EmailTemplate"("key");
