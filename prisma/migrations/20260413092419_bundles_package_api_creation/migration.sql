-- CreateEnum
CREATE TYPE "BundleType" AS ENUM ('FLEXIBLE', 'LOCKED');

-- CreateEnum
CREATE TYPE "BundlePricingMethod" AS ENUM ('HOURLY', 'TIERED', 'DAILY', 'CUSTOM');

-- CreateTable
CREATE TABLE "bundles" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "BundleType" NOT NULL DEFAULT 'FLEXIBLE',
    "pricingMethod" "BundlePricingMethod" NOT NULL DEFAULT 'TIERED',
    "pricingConfig" JSONB,
    "bundlePrice" INTEGER NOT NULL DEFAULT 0,
    "savings" INTEGER NOT NULL DEFAULT 0,
    "suggestedEventTypes" TEXT,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "bundles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bundle_items" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "bundle_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bundles_orgId_idx" ON "bundles"("orgId");

-- CreateIndex
CREATE INDEX "bundles_orgId_deletedAt_idx" ON "bundles"("orgId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "bundles_orgId_name_key" ON "bundles"("orgId", "name");

-- CreateIndex
CREATE INDEX "bundle_items_orgId_idx" ON "bundle_items"("orgId");

-- CreateIndex
CREATE INDEX "bundle_items_bundleId_idx" ON "bundle_items"("bundleId");

-- CreateIndex
CREATE INDEX "bundle_items_productId_idx" ON "bundle_items"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "bundle_items_bundleId_productId_key" ON "bundle_items"("bundleId", "productId");

-- AddForeignKey
ALTER TABLE "bundles" ADD CONSTRAINT "bundles_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
