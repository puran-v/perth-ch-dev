-- Author: Puran
-- Impact: convert the (productId, label) unique index on
--         product_variants from a full unique index to a partial
--         unique index that only enforces uniqueness on active rows
-- Reason: the previous migration created a full unique index, which
--         meant a soft-deleted "Medium" variant still occupied the
--         slot — re-adding a "Medium" after deleting one would 409
--         on the @@unique constraint even though the row was gone
--         from the user's perspective. Soft-delete + re-add of the
--         same label is a legitimate flow (admin removed a variant
--         then added it back in the same session, or after a few
--         days), so the index needs a `WHERE deletedAt IS NULL`
--         predicate to exclude soft-deleted rows.
--
-- Prisma doesn't natively model partial indexes in schema.prisma,
-- so this migration is hand-written SQL. The schema still declares
-- @@unique([productId, label]) — Prisma's understanding of the
-- index is "logically unique" which is what we want from the type
-- system (TypeScript still treats it as a unique constraint for
-- relations / where filters). The DB-level enforcement just gets a
-- WHERE clause via this raw migration.
--
-- Drop + recreate is safe: there are no rows yet (this PR is the
-- one that introduces product_variants in the first place).

DROP INDEX "product_variants_productId_label_key";

CREATE UNIQUE INDEX "product_variants_productId_label_key"
  ON "product_variants"("productId", "label")
  WHERE "deletedAt" IS NULL;
