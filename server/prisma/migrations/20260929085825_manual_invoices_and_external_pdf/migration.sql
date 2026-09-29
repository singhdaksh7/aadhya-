-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "createdByAdminId" TEXT,
ADD COLUMN     "externalInvoiceDate" TIMESTAMP(3),
ADD COLUMN     "externalInvoiceNumber" TEXT,
ADD COLUMN     "externalPdfIsCanonical" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "externalPdfStorageKey" TEXT,
ADD COLUMN     "externalPdfUploadedAt" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "paymentReference" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'ONLINE',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ISSUED',
ALTER COLUMN "invoiceNumber" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Invoice_source_idx" ON "Invoice"("source");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
