-- CreateEnum
CREATE TYPE "ImportKind" AS ENUM ('CUSTOMERS', 'PRODUCTS', 'BOOKINGS');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "BookingPaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- CreateTable
CREATE TABLE "customers" (
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

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "dailyRate" DECIMAL(10,2) NOT NULL,
    "weeklyRate" DECIMAL(10,2),
    "totalQuantity" INTEGER NOT NULL DEFAULT 1,
    "weightKg" DECIMAL(8,2),
    "lengthCm" DECIMAL(8,2),
    "widthCm" DECIMAL(8,2),
    "heightCm" DECIMAL(8,2),
    "setupMinutes" INTEGER,
    "packdownMinutes" INTEGER,
    "powerRequired" BOOLEAN NOT NULL DEFAULT false,
    "ageGroupMin" INTEGER,
    "ageGroupMax" INTEGER,
    "maxOccupancy" INTEGER,
    "safetyNotes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
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

-- CreateTable
CREATE TABLE "import_jobs" (
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

-- CreateIndex
CREATE INDEX "customers_orgId_idx" ON "customers"("orgId");

-- CreateIndex
CREATE INDEX "customers_orgId_lastName_firstName_idx" ON "customers"("orgId", "lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX "customers_orgId_email_key" ON "customers"("orgId", "email");

-- CreateIndex
CREATE INDEX "products_orgId_idx" ON "products"("orgId");

-- CreateIndex
CREATE INDEX "products_orgId_name_idx" ON "products"("orgId", "name");

-- CreateIndex
CREATE INDEX "products_orgId_category_idx" ON "products"("orgId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "products_orgId_sku_key" ON "products"("orgId", "sku");

-- CreateIndex
CREATE INDEX "bookings_orgId_idx" ON "bookings"("orgId");

-- CreateIndex
CREATE INDEX "bookings_orgId_eventDate_idx" ON "bookings"("orgId", "eventDate");

-- CreateIndex
CREATE INDEX "bookings_customerId_idx" ON "bookings"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_orgId_externalRef_key" ON "bookings"("orgId", "externalRef");

-- CreateIndex
CREATE INDEX "import_jobs_orgId_idx" ON "import_jobs"("orgId");

-- CreateIndex
CREATE INDEX "import_jobs_orgId_kind_idx" ON "import_jobs"("orgId", "kind");

-- CreateIndex
CREATE INDEX "import_jobs_orgId_kind_createdAt_idx" ON "import_jobs"("orgId", "kind", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
