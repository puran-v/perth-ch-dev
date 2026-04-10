-- Author: Puran
-- Impact: introduce per-org ProductCategory master list and a nullable
--         FK column on products. Legacy `products.category` (free text)
--         stays in place for the dual-write rollout phase — a follow-up
--         migration drops it once every consumer reads via categoryId.
-- Reason: Categories were free-text strings on products, which made
--         filtering / reporting / archiving impossible. Promoting them
--         to a real table per org with @@unique([orgId, slug]) gives
--         us case-insensitive uniqueness, soft delete, and a
--         predictable surface for the future categories admin page.

-- CreateTable
CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_categories_orgId_idx" ON "product_categories"("orgId");

-- CreateIndex
CREATE INDEX "product_categories_orgId_sortOrder_idx" ON "product_categories"("orgId", "sortOrder");

-- CreateIndex
CREATE INDEX "product_categories_orgId_deletedAt_idx" ON "product_categories"("orgId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_orgId_slug_key" ON "product_categories"("orgId", "slug");

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "products" ADD COLUMN "categoryId" TEXT;

-- CreateIndex
CREATE INDEX "products_orgId_categoryId_idx" ON "products"("orgId", "categoryId");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
