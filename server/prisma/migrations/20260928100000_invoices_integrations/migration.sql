CREATE TABLE "InvoiceSequence" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "nextNumber" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invoice" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "customerName" TEXT NOT NULL,
  "customerEmail" TEXT NOT NULL,
  "customerPhone" TEXT,
  "billingAddress" JSONB NOT NULL,
  "shippingAddress" JSONB,
  "subtotal" DECIMAL(10,2) NOT NULL,
  "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "shippingAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "companySnapshot" JSONB NOT NULL,
  "taxSnapshot" JSONB,
  "itemsSnapshot" JSONB NOT NULL,
  "pdfStorageKey" TEXT,
  "emailedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Invoice_orderId_key" ON "Invoice"("orderId");
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE INDEX "Invoice_customerEmail_idx" ON "Invoice"("customerEmail");
CREATE INDEX "Invoice_createdAt_idx" ON "Invoice"("createdAt");
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "IntegrationCredential" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "encryptedData" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastTestedAt" TIMESTAMP(3),
  "testStatus" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntegrationCredential_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IntegrationCredential_provider_environment_key" ON "IntegrationCredential"("provider", "environment");

CREATE TABLE "EmailLog" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "orderId" TEXT,
  "invoiceId" TEXT,
  "status" TEXT NOT NULL,
  "providerMessageId" TEXT,
  "sentAt" TIMESTAMP(3),
  "failureMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EmailLog_orderId_idx" ON "EmailLog"("orderId");
CREATE INDEX "EmailLog_invoiceId_idx" ON "EmailLog"("invoiceId");
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AdminAuditLog" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "provider" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdminAuditLog_adminId_idx" ON "AdminAuditLog"("adminId");
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

ALTER TABLE "Shipment" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "providerShipmentId" TEXT,
ADD COLUMN "awb" TEXT,
ADD COLUMN "labelStorageKey" TEXT,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN "lastError" TEXT;
