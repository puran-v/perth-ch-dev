-- Author: Puran
-- Impact: backfill ProductCategory rows from existing free-text
--         products.category strings, then point each product's
--         categoryId at the matching new row.
-- Reason: ships in the same PR as the schema migration so the dual-
--         write phase has real data on day one. Idempotent — safe to
--         re-run if the migration history is replayed against a
--         partially-backfilled DB.
--
-- Strategy:
--   1. INSERT one ProductCategory per (orgId, lowercase trimmed name).
--      ON CONFLICT does nothing so re-runs are safe; the unique index
--      is (orgId, slug), so case variants ("Inflatable" / "inflatable")
--      collapse into a single row. The display `name` takes the
--      lexicographically smallest casing for determinism.
--   2. UPDATE products SET categoryId = (matching row id) for every
--      product that has a non-empty legacy category string.
--   3. Skip products with empty / NULL category — they'll get a
--      categoryId the first time the user saves the row through the
--      new combobox.

-- Step 1: insert categories from distinct (orgId, slug) pairs
INSERT INTO "product_categories" (
  "id",
  "orgId",
  "name",
  "slug",
  "sortOrder",
  "active",
  "createdAt",
  "updatedAt"
)
SELECT
  -- gen_random_uuid() is in pgcrypto / Postgres 13+; the migration
  -- chain already runs against a DB that supports it. Casting to
  -- text matches the cuid() string column type.
  gen_random_uuid()::text AS id,
  src."orgId",
  src."name",
  src."slug",
  0 AS "sortOrder",
  true AS "active",
  NOW() AS "createdAt",
  NOW() AS "updatedAt"
FROM (
  SELECT
    p."orgId",
    -- Display name = the lexicographically smallest casing for the
    -- slug. Deterministic and lets the admin re-case it later.
    MIN(p."category") AS "name",
    LOWER(BTRIM(p."category")) AS "slug"
  FROM "products" p
  WHERE p."category" IS NOT NULL
    AND BTRIM(p."category") <> ''
    AND p."deletedAt" IS NULL
  GROUP BY p."orgId", LOWER(BTRIM(p."category"))
) src
ON CONFLICT ("orgId", "slug") DO NOTHING;

-- Step 2: point every product at its matching category row
UPDATE "products" p
SET "categoryId" = pc."id"
FROM "product_categories" pc
WHERE pc."orgId" = p."orgId"
  AND pc."slug" = LOWER(BTRIM(p."category"))
  AND p."category" IS NOT NULL
  AND BTRIM(p."category") <> ''
  AND p."deletedAt" IS NULL
  AND p."categoryId" IS NULL;
