-- AddColumn: configNotes (free-text notes shown inside the quote builder configurator)
-- Additive / nullable — no backfill needed, existing rows get NULL.
ALTER TABLE "Product" ADD COLUMN "configNotes" TEXT;
