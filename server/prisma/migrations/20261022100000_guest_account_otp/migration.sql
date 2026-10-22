-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "autoCreated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "passwordSetAt" TIMESTAMP(3);

-- Existing customers all chose their own password when they registered.
UPDATE "Customer" SET "passwordSetAt" = "createdAt";

-- CreateTable
CREATE TABLE "CustomerLoginOtp" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerLoginOtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerLoginOtp_customerId_createdAt_idx" ON "CustomerLoginOtp"("customerId", "createdAt");

-- AddForeignKey
ALTER TABLE "CustomerLoginOtp" ADD CONSTRAINT "CustomerLoginOtp_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
