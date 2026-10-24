-- Additive only: nothing is dropped or rewritten. Existing rows default to the CUSTOMER audience.
ALTER TABLE "EmailLog" ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'CUSTOMER';
CREATE INDEX "EmailLog_audience_idx" ON "EmailLog"("audience");

ALTER TABLE "NotificationEvent" ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'CUSTOMER';

CREATE TABLE "AdminNotificationRecipient" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdminNotificationRecipient_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdminNotificationRecipient_email_key" ON "AdminNotificationRecipient"("email");
