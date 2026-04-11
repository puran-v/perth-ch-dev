Build a CSV Import Module for a multi-tenant platform. It's a one-time data migration tool to move data from an old system (ERS) into the new platform.
Requirements
Flow
Three sequential import steps: Customers → Products → Bookings (Bookings optional). Each step must be completed before the next unlocks.
Frontend (React + Tailwind)

CSV Import page with 3 cards, each showing a status pill (Done / Pending).
Each card contains:

A drop zone (accepts .csv only)
Download Template button
View Mapping Guide button (opens modal)


Mapping Guide modal with 3 tabs:

Field Reference — column headers, required/optional, data type, notes
Example CSV — formatted preview + Copy CSV button
Validation Rules — errors (block row), warnings (import + flag), notes


On upload: show progress, then a results report (total / imported / skipped + downloadable error log).
Step 2 unlocks only after Step 1 = Done; Step 3 only after Step 2 = Done. Read unlock state from backend (customers_import_done, products_import_done flags on tenant).

Backend

Upload endpoint: POST /api/import/:type (multipart). Store file in S3 temp blob with tenant_id and import_id.
Pre-validate: UTF-8 encoding, file size, row count (≤ 10,000), header row matches schema.
Stream parse row-by-row (use csv-parser / papaparse — do not load whole file in memory).
Per-row validation:

Errors (reject row): missing first_name / last_name / email, invalid email format
Warnings (skip + log): duplicate email already in DB (don't overwrite)


Batch insert valid rows (500 at a time) inside a transaction, scoped by tenant_id.
Report: write summary to import_jobs table — { total, success, skipped, failed, error_log_url }.
Status endpoint: GET /api/import/:import_id/status for frontend polling.
Gate next step: mark customers_import_done = true on tenant only when at least one successful import exists.

Rules

Multi-tenant: every row tagged with tenant_id
Idempotency: email is unique key per tenant — re-running must not duplicate
Phone: stored as-is (no formatting)
Tags: split by comma into array / junction table
Async jobs (BullMQ) for files > 1k rows so HTTP requests don't hang

DB Tables

customers: id, tenant_id, first_name, last_name, email (UNIQUE per tenant), phone, mobile, company, address_*, notes, tags[]
import_jobs: id, tenant_id, type, status, totals, error_log_path, created_at

Deliverables

Frontend: CSVImportPage.jsx, ImportCard.jsx, MappingGuideModal.jsx, ResultsReport.jsx (reuse existing shared components where possible).
Backend: upload route, streaming parser, validator, batch inserter, status endpoint, BullMQ worker.
DB migrations for customers and import_jobs.
A sample customers.csv with 5 rows for testing.

Start by scaffolding the backend (routes + worker + migrations), then the frontend page. Ask before making schema assumptions that conflict with existing tables.