-- CreateEnum (IF NOT EXISTS so re-runs are safe)
DO $$ BEGIN
  CREATE TYPE "ImportKind" AS ENUM ('CUSTOMERS', 'PRODUCTS', 'BOOKINGS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ImportStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BookingPaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable: customers
CREATE TABLE IF NOT EXISTS "customers" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "mobile" TEXT,
    "company" TEXT,
    "addressLine1" TEXT,
    "addressSuburb" TEXT,
    "addressState" TEXT,
    "addressPostcode" TEXT,
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: bookings
CREATE TABLE IF NOT EXISTS "bookings" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "externalRef" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "eventDate" DATE NOT NULL,
    "eventStartTime" TEXT,
    "eventEndTime" TEXT,
    "deliveryAddress" TEXT NOT NULL,
    "deliverySuburb" TEXT,
    "deliveryState" TEXT,
    "deliveryPostcode" TEXT,
    "contactPhone" TEXT,
    "specialInstructions" TEXT,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "depositPaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "balanceDue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "paymentStatus" "BookingPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: import_jobs
CREATE TABLE IF NOT EXISTS "import_jobs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "kind" "ImportKind" NOT NULL,
    "status" "ImportStatus" NOT NULL,
    "filename" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdBy" TEXT,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (IF NOT EXISTS for idempotency)
CREATE INDEX IF NOT EXISTS "customers_orgId_idx" ON "customers"("orgId");
CREATE INDEX IF NOT EXISTS "customers_orgId_lastName_firstName_idx" ON "customers"("orgId", "lastName", "firstName");
CREATE UNIQUE INDEX IF NOT EXISTS "customers_orgId_email_key" ON "customers"("orgId", "email");

CREATE INDEX IF NOT EXISTS "bookings_orgId_idx" ON "bookings"("orgId");
CREATE INDEX IF NOT EXISTS "bookings_orgId_eventDate_idx" ON "bookings"("orgId", "eventDate");
CREATE INDEX IF NOT EXISTS "bookings_customerId_idx" ON "bookings"("customerId");
CREATE UNIQUE INDEX IF NOT EXISTS "bookings_orgId_externalRef_key" ON "bookings"("orgId", "externalRef");

CREATE INDEX IF NOT EXISTS "import_jobs_orgId_idx" ON "import_jobs"("orgId");
CREATE INDEX IF NOT EXISTS "import_jobs_orgId_kind_idx" ON "import_jobs"("orgId", "kind");
CREATE INDEX IF NOT EXISTS "import_jobs_orgId_kind_createdAt_idx" ON "import_jobs"("orgId", "kind", "createdAt" DESC);

-- AddForeignKey (use DO blocks so constraint-already-exists doesn't fail)
DO $$ BEGIN
  ALTER TABLE "customers" ADD CONSTRAINT "customers_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
