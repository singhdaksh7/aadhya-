DO $$ BEGIN
    CREATE TYPE "PageType" AS ENUM ('HOME', 'STANDARD', 'LANDING');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PageStatus" AS ENUM ('DRAFT', 'PUBLISHED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "Page" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "pageType" "PageType" NOT NULL DEFAULT 'STANDARD',
    "status" "PageStatus" NOT NULL DEFAULT 'DRAFT',
    "content" TEXT,
    "featuredImage" TEXT,
    "excerpt" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Page" ADD COLUMN IF NOT EXISTS "content" TEXT;
ALTER TABLE "Page" ADD COLUMN IF NOT EXISTS "featuredImage" TEXT;
ALTER TABLE "Page" ADD COLUMN IF NOT EXISTS "excerpt" TEXT;
ALTER TABLE "Page" ADD COLUMN IF NOT EXISTS "seoTitle" TEXT;
ALTER TABLE "Page" ADD COLUMN IF NOT EXISTS "seoDescription" TEXT;
ALTER TABLE "Page" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "PageSection" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB,
    "content" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BlogPost" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "featuredImage" TEXT,
    "content" TEXT NOT NULL,
    "author" TEXT DEFAULT 'Aadya Editorial',
    "category" TEXT,
    "tags" JSONB,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "status" "PageStatus" NOT NULL DEFAULT 'DRAFT',
    "publishDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FAQCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FAQCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FAQItem" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FAQItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MediaAsset" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageDriver" TEXT NOT NULL DEFAULT 'local',
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "altText" TEXT,
    "title" TEXT,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Page_slug_key" ON "Page"("slug");
CREATE INDEX IF NOT EXISTS "Page_slug_idx" ON "Page"("slug");
CREATE INDEX IF NOT EXISTS "Page_status_idx" ON "Page"("status");
CREATE INDEX IF NOT EXISTS "Page_pageType_idx" ON "Page"("pageType");

CREATE INDEX IF NOT EXISTS "PageSection_pageId_idx" ON "PageSection"("pageId");
CREATE INDEX IF NOT EXISTS "PageSection_sortOrder_idx" ON "PageSection"("sortOrder");

CREATE UNIQUE INDEX IF NOT EXISTS "BlogPost_slug_key" ON "BlogPost"("slug");
CREATE INDEX IF NOT EXISTS "BlogPost_slug_idx" ON "BlogPost"("slug");
CREATE INDEX IF NOT EXISTS "BlogPost_status_idx" ON "BlogPost"("status");
CREATE INDEX IF NOT EXISTS "BlogPost_publishDate_idx" ON "BlogPost"("publishDate");
CREATE INDEX IF NOT EXISTS "BlogPost_category_idx" ON "BlogPost"("category");
CREATE INDEX IF NOT EXISTS "BlogPost_isFeatured_idx" ON "BlogPost"("isFeatured");

CREATE UNIQUE INDEX IF NOT EXISTS "FAQCategory_slug_key" ON "FAQCategory"("slug");
CREATE INDEX IF NOT EXISTS "FAQCategory_isActive_idx" ON "FAQCategory"("isActive");
CREATE INDEX IF NOT EXISTS "FAQCategory_sortOrder_idx" ON "FAQCategory"("sortOrder");

CREATE INDEX IF NOT EXISTS "FAQItem_categoryId_idx" ON "FAQItem"("categoryId");
CREATE INDEX IF NOT EXISTS "FAQItem_isActive_idx" ON "FAQItem"("isActive");
CREATE INDEX IF NOT EXISTS "FAQItem_sortOrder_idx" ON "FAQItem"("sortOrder");

CREATE INDEX IF NOT EXISTS "MediaAsset_createdAt_idx" ON "MediaAsset"("createdAt");
CREATE INDEX IF NOT EXISTS "MediaAsset_storageKey_idx" ON "MediaAsset"("storageKey");

DO $$ BEGIN
    ALTER TABLE "PageSection" ADD CONSTRAINT "PageSection_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "FAQItem" ADD CONSTRAINT "FAQItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FAQCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
