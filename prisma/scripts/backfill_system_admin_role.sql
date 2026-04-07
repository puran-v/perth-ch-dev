-- ───────────────────────────────────────────────────────────────────
-- Backfill: seed a system "Admin" OrganizationRole for every
-- pre-existing organization and attach every org's founding users
-- (users whose organizationRoleId is currently NULL) to it.
--
-- Why this exists:
--   The Team & Users V1 migration added isSystem to OrganizationRole
--   and PUT /api/org-setup now creates the Admin role + attaches the
--   founder inside a single transaction for NEW orgs. Orgs that were
--   created BEFORE that change have no system role and their users
--   show up blank on the Users page. This script fixes existing dev
--   DBs without requiring the user to re-run org-setup.
--
-- Safe to re-run: uses ON CONFLICT DO NOTHING on the unique
-- (orgId, name) index so a second invocation is a no-op.
--
-- How to run:
--   npx prisma db execute --file prisma/scripts/backfill_system_admin_role.sql
--
-- @author Puran
-- @created 2026-04-06
-- ───────────────────────────────────────────────────────────────────

BEGIN;

-- Step 1: create a system Admin role in every org that doesn't already
-- have a row named "Admin". ON CONFLICT keeps this idempotent — existing
-- admin rows (including any user-created ones called "Admin") are left
-- alone, so we can't accidentally stomp on real data.
INSERT INTO organization_roles (
  id,
  "orgId",
  name,
  description,
  "sortOrder",
  "isSystem",
  "moduleA",
  "moduleB",
  "moduleC",
  "moduleD",
  "moduleE",
  "createdAt",
  "updatedAt"
)
SELECT
  'backfill_admin_' || substr(md5(o.id), 1, 20),
  o.id,
  'Admin',
  'Full access to every module. Seeded by backfill for legacy orgs.',
  0,
  true,
  true,
  true,
  true,
  true,
  true,
  NOW(),
  NOW()
FROM organizations o
WHERE o."deletedAt" IS NULL
ON CONFLICT ("orgId", name) DO NOTHING;

-- Step 2: attach every user currently missing an organizationRoleId
-- to their org's system Admin role. Users who already have a role
-- assigned (e.g. invited members) are left alone.
UPDATE users u
SET "organizationRoleId" = r.id,
    "updatedAt" = NOW()
FROM organization_roles r
WHERE u."organizationRoleId" IS NULL
  AND u."orgId" IS NOT NULL
  AND u."deletedAt" IS NULL
  AND r."orgId" = u."orgId"
  AND r."isSystem" = true
  AND r."deletedAt" IS NULL;

COMMIT;
