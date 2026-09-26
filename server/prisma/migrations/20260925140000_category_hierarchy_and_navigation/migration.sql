-- CreateEnum
CREATE TYPE "NavigationItemType" AS ENUM ('CATEGORY', 'COLLECTION', 'PAGE', 'CUSTOM');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN "icon" TEXT,
ADD COLUMN "logo" TEXT,
ADD COLUMN "desktopBanner" TEXT,
ADD COLUMN "mobileBanner" TEXT,
ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "seoTitle" TEXT,
ADD COLUMN "seoDescription" TEXT;

-- CreateIndex
CREATE INDEX "Category_isFeatured_idx" ON "Category"("isFeatured");

-- CreateTable
CREATE TABLE "NavigationMenu" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NavigationMenu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NavigationItem" (
    "id" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "type" "NavigationItemType" NOT NULL DEFAULT 'CUSTOM',
    "targetId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "icon" TEXT,
    "badgeText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NavigationItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NavigationMenu_code_key" ON "NavigationMenu"("code");

-- CreateIndex
CREATE INDEX "NavigationMenu_code_idx" ON "NavigationMenu"("code");

-- CreateIndex
CREATE INDEX "NavigationItem_menuId_idx" ON "NavigationItem"("menuId");

-- CreateIndex
CREATE INDEX "NavigationItem_parentId_idx" ON "NavigationItem"("parentId");

-- CreateIndex
CREATE INDEX "NavigationItem_sortOrder_idx" ON "NavigationItem"("sortOrder");

-- AddForeignKey
ALTER TABLE "NavigationItem" ADD CONSTRAINT "NavigationItem_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "NavigationMenu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NavigationItem" ADD CONSTRAINT "NavigationItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "NavigationItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
