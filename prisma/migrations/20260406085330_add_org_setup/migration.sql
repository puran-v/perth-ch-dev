-- CreateEnum
CREATE TYPE "OrgSetupStatus" AS ENUM ('DRAFT', 'COMPLETE');

-- CreateTable
CREATE TABLE "org_setups" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "status" "OrgSetupStatus" NOT NULL DEFAULT 'DRAFT',
    "business" JSONB,
    "warehouse" JSONB,
    "payment" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "org_setups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_setups_orgId_key" ON "org_setups"("orgId");

-- CreateIndex
CREATE INDEX "org_setups_orgId_idx" ON "org_setups"("orgId");

-- AddForeignKey
ALTER TABLE "org_setups" ADD CONSTRAINT "org_setups_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
