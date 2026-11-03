-- CreateEnum
CREATE TYPE "BulkGiftingInquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED');

-- CreateTable
CREATE TABLE "BulkGiftingInquiry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "company" TEXT,
    "quantity" INTEGER NOT NULL,
    "budget" TEXT,
    "occasion" TEXT NOT NULL,
    "preferredDate" TEXT,
    "location" TEXT,
    "message" TEXT NOT NULL,
    "status" "BulkGiftingInquiryStatus" NOT NULL DEFAULT 'NEW',
    "source" TEXT NOT NULL DEFAULT 'STOREFRONT_GIFTING',
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulkGiftingInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BulkGiftingInquiry_status_idx" ON "BulkGiftingInquiry"("status");

-- CreateIndex
CREATE INDEX "BulkGiftingInquiry_createdAt_idx" ON "BulkGiftingInquiry"("createdAt");

