-- AlterTable
ALTER TABLE "org_setups" ADD COLUMN     "completedSteps" JSONB NOT NULL DEFAULT '[]';
