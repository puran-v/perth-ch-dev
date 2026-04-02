/*
  Warnings:

  - Added the required column `updatedAt` to the `email_verification_otps` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "email_verification_otps" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "orgId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "orgId" TEXT;

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_verification_otps_orgId_idx" ON "email_verification_otps"("orgId");

-- CreateIndex
CREATE INDEX "users_orgId_idx" ON "users"("orgId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_otps" ADD CONSTRAINT "email_verification_otps_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
