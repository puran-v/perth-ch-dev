# Feature: CSV Import (Module A)

## Overview

One-time data migration tool — moves Customers, Products, and Bookings from
the legacy ERS system into the platform during cutover. Three sequential
import steps gated on the order Customers → Products → Bookings.

## Flow

1. Operator opens `/dashboard/csv-import` (gated by `module: "A"` + the new
   `import.run` permission — ADMIN + MANAGER roles only).
2. Page loads `GET /api/orgs/current/import/status` and renders one of four
   pill states per step: **Done** / **Pending** / **Importing…** / **Failed**.
3. Operator clicks **View Mapping Guide** to see the field reference,
   example CSV, and validation rules for the relevant kind. The same modal
   exposes a **Download template CSV** button that returns a header-only
   CSV from `GET /api/orgs/current/import/templates/[kind]`.
4. Operator drops a `.csv` file on the corresponding card. The frontend
   POSTs `multipart/form-data` to `POST /api/orgs/current/import/[kind]`.
5. Backend pre-validates (size, encoding, headers, row count ≤ 10k),
   parses, runs per-row Zod validation, batches inserts in chunks of 500
   with `skipDuplicates: true`, and persists an `ImportJob` row capturing
   the outcome.
6. Frontend invalidates the status query → pills refresh → operator can
   re-run the import for any step until all three are **Done**.

## API endpoints

| Method | Endpoint                                              | Description                                 | Auth                |
|--------|-------------------------------------------------------|---------------------------------------------|---------------------|
| GET    | `/api/orgs/current/import/status`                     | Most-recent ImportJob per kind for the org  | `import.run`        |
| POST   | `/api/orgs/current/import/[kind]`                     | Multipart upload — runs the named importer  | `import.run`        |
| GET    | `/api/orgs/current/import/jobs/[id]`                  | Single ImportJob detail with full error log | `import.run`        |
| GET    | `/api/orgs/current/import/templates/[kind]`           | Header-only CSV download                    | `import.run`        |

`[kind]` ∈ `customers`, `products`, `bookings`.

## Database tables involved

- **`customers`** — destination for the customers CSV. Natural key
  `(orgId, email)` enforces idempotency.
- **`products`** — destination for the products CSV. Natural key
  `(orgId, sku)` enforces idempotency when SKU is present (SKU is
  optional but products without one cannot be referenced from a bookings
  import).
- **`bookings`** — destination for the bookings CSV (header-only for V1,
  no line items). Natural key `(orgId, externalRef)` enforces
  idempotency. Each row resolves a `customerId` by looking up the
  imported customer email at insert time.
- **`import_jobs`** — audit row per import run. Stores totals + capped
  per-row error log (max 500 entries) + optional top-level `failureReason`
  for pre-validation rejections.

## Parameters / inputs

### `POST /api/orgs/current/import/[kind]`

Body: `multipart/form-data` with a single field:

| Field | Type | Required | Description                          |
|-------|------|----------|--------------------------------------|
| file  | File | yes      | A `.csv` file (UTF-8, ≤ 25 MB, ≤ 10k data rows) |

The required + optional headers per kind live in
`src/server/lib/validation/csv-import.ts` and are surfaced verbatim by
the Mapping Guide modal in the FE so the two can never drift.

## Business rules

- **Multi-tenant.** Every imported row is tagged with `orgId` from the
  session — never trusted from the client.
- **Idempotency.** Re-running the same import is a no-op for any row
  whose natural key already exists in the org. Skipped rows count toward
  `skippedRows`, not `failedRows`.
- **Customers before bookings.** Bookings reference customers by email
  at import time. A booking row whose email isn't found in the org is
  reported with `code: CUSTOMER_NOT_FOUND` and counted as failed.
- **Products before bookings (when using SKUs).** V1 doesn't import
  booking line items, so the SKU dependency is informational only —
  documented in the bookings mapping guide validation rules.
- **No partial transaction rollback.** Inserts are batched in chunks of
  500 *outside* a single all-or-nothing transaction so a failed batch
  doesn't roll back the whole import. Each batch is its own short
  transaction via `createMany`.
- **Header-only bookings (V1).** The Booking model exists but
  `BookingItem` is intentionally not part of this PR. Line items get
  backfilled in the booking edit UI when the V2 booking module lands.
- **Soft delete.** All four new tables carry `deletedAt`; nothing is
  hard-deleted.

## Error scenarios

### Pre-validation (no rows attempted)

| Code                       | Status | Cause                                                |
|----------------------------|--------|------------------------------------------------------|
| `INVALID_KIND`             | 400    | `[kind]` path param is not customers/products/bookings |
| `INVALID_MULTIPART`        | 400    | Body wasn't multipart/form-data                      |
| `MISSING_FILE`             | 400    | `file` field absent                                  |
| `INVALID_FILE_TYPE`        | 400    | Not a `.csv` file                                    |
| `FILE_TOO_LARGE`           | 413    | File exceeds 25 MB                                   |
| `EMPTY_FILE`               | 422    | Zero bytes / no data rows                            |
| `MISSING_REQUIRED_HEADERS` | 422    | One or more required column headers missing         |
| `UNKNOWN_HEADERS`          | 422    | Header in the file isn't in the schema              |
| `MALFORMED_CSV`            | 422    | Unbalanced quotes or embedded newline in a quoted cell |
| `ROW_LIMIT_EXCEEDED`       | 422    | More than 10,000 data rows                          |

A pre-validation rejection still creates a `FAILED` ImportJob row so the
status pill flips and the operator sees what happened.

### Per-row (some rows attempted)

| Code                | Cause                                                          |
|---------------------|----------------------------------------------------------------|
| `VALIDATION_ERROR`  | Per-field Zod validation failure (missing/invalid value)       |
| `INVALID_RANGE`     | Cross-cell rule (e.g. `age_group_max` < `age_group_min`)       |
| `DUPLICATE_IN_FILE` | The same natural-key value appears more than once in the file  |
| `CUSTOMER_NOT_FOUND`| (Bookings only) email doesn't match any customer in the org    |
| `DB_INSERT_FAILED`  | Whole-batch DB error (rare) — every row in the batch is flagged|

Per-row errors are stored on the `ImportJob.errors` JSON column (capped
at 500 entries) and returned both inline on the upload response and via
`GET /api/orgs/current/import/jobs/[id]`.

## What's deferred

- **Async / BullMQ workers** — V1 is fully synchronous. The 10k row cap
  + 25 MB file cap keep request times ≤ ~2s. The `ImportJob.status`
  enum already includes `RUNNING` so the schema is ready to add a queue
  worker without a migration.
- **S3 / temp blob storage** — V1 reads the file in memory inside the
  route handler. Add when async lands.
- **Booking line items** — header-only for V1. Backfilled via the
  booking edit UI in V2.
- **AI features** — none. CSV import is a deterministic data migration
  tool and doesn't expose any Claude API surface.
