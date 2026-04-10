-- Author: Puran
-- Impact: introduces the four-way ProductType discriminator, the
--         pricingConfig + addonGroups JSONB columns, and the
--         product_variants table that backs SIZE_VARIANT products.
-- Reason: §1-3 of the Configurable Product Pricing spec — the admin
--         form needs persistent pricing rules per product, and
--         size_variant products need their own per-variant inventory
--         pool (the "important distinction" in §3 of the PDF).
--
-- Backfill policy: every existing product → STANDARD. Guessing
-- DIMENSION_BASED from the legacy `configurable` boolean would risk
-- assigning the wrong pricing model to non-marquee items. Admins
-- re-pick the type from the dropdown after this PR ships.
--
-- Legacy `configurable` column stays in place — same dual-write
-- discipline as the categories migration. A follow-up PR drops it
-- once every consumer reads productType.

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('STANDARD', 'DIMENSION_BASED', 'SIZE_VARIANT', 'QUANTITY_ADDONS');

-- AlterTable
ALTER TABLE "products"
  ADD COLUMN "productType" "ProductType" NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "pricingConfig" JSONB,
  ADD COLUMN "addonGroups" JSONB DEFAULT '[]';

-- CreateIndex
CREATE INDEX "products_orgId_productType_idx" ON "products"("orgId", "productType");

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "priceDay" INTEGER NOT NULL,
    "priceHalfday" INTEGER,
    "priceOvernight" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "skuSuffix" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_variants_orgId_idx" ON "product_variants"("orgId");

-- CreateIndex
CREATE INDEX "product_variants_productId_sortOrder_idx" ON "product_variants"("productId", "sortOrder");

-- CreateIndex
CREATE INDEX "product_variants_orgId_deletedAt_idx" ON "product_variants"("orgId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_productId_label_key" ON "product_variants"("productId", "label");

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
