-- AddColumns: components + accessories (inventory tab JSONB arrays)
-- Additive / nullable with defaults — no backfill needed.
ALTER TABLE "products" ADD COLUMN "components" JSONB DEFAULT '[]';
ALTER TABLE "products" ADD COLUMN "accessories" JSONB DEFAULT '[]';
