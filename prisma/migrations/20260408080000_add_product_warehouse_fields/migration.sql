-- AlterTable
ALTER TABLE "products"
  ADD COLUMN "warehouseZone" TEXT,
  ADD COLUMN "warehouseBayShelf" TEXT,
  ADD COLUMN "warehouseLocationNotes" TEXT,
  ADD COLUMN "requiresCleaning" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requiresCharging" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requiresConsumableCheck" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requiresInspection" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "customPostJobRules" TEXT[] DEFAULT ARRAY[]::TEXT[];
