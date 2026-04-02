-- AlterTable
ALTER TABLE "email_verification_otps" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "password_reset_tokens" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "sessions" ALTER COLUMN "updatedAt" DROP DEFAULT;
