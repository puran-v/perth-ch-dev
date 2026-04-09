-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'NO_PRICE', 'INACTIVE');

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "description" TEXT,
    "configurable" BOOLEAN NOT NULL DEFAULT false,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "basePrice" INTEGER NOT NULL DEFAULT 0,
    "setupMinutes" INTEGER NOT NULL DEFAULT 0,
    "packdownMinutes" INTEGER NOT NULL DEFAULT 0,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "products_orgId_idx" ON "products"("orgId");

-- CreateIndex
CREATE INDEX "products_orgId_status_idx" ON "products"("orgId", "status");

-- CreateIndex
CREATE INDEX "products_orgId_category_idx" ON "products"("orgId", "category");

-- CreateIndex
CREATE INDEX "products_orgId_deletedAt_idx" ON "products"("orgId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "products_orgId_sku_key" ON "products"("orgId", "sku");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
