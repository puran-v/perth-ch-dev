-- AlterTable
ALTER TABLE "organization_roles" ADD COLUMN     "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "organization_roles_orgId_isSystem_idx" ON "organization_roles"("orgId", "isSystem");
