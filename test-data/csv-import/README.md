# CSV Import — test fixtures

Sample CSVs you can drop on the **Dashboard → CSV Import** page to walk
the full Module A migration flow end-to-end without needing data from
ERS. All four files are valid UTF-8, comma-separated, RFC 4180 quoted
where needed.

> The platform accepts `.csv` only — open these in Excel/Numbers/Sheets
> if you want to view or tweak them, then **Save As → CSV (UTF-8)**
> before re-uploading.

## The happy path (test in this order)

Run the steps in the order the page enforces — **Customers → Products →
Bookings**. Bookings reference customers by email, so importing bookings
before customers will fail every row with `CUSTOMER_NOT_FOUND`.

| # | File             | What's inside                                     | Expected outcome                                                       |
|---|------------------|---------------------------------------------------|------------------------------------------------------------------------|
| 1 | `customers.csv`  | 8 Perth-based customers (mix of personal + corporate, multi-tag, addresses with embedded commas, apostrophes) | Imported: **8** · Skipped: **0** · Failed: **0** → step pill flips to **Done** |
| 2 | `products.csv`   | 8 rentable items (4 inflatables, 2 marquees, 2 add-ons), one product (Snow Machine) deliberately has no SKU to test the optional-SKU path | Imported: **8** · Skipped: **0** · Failed: **0** → step pill flips to **Done** |
| 3 | `bookings.csv`   | 8 bookings — one per customer in `customers.csv`, mix of `paid` / `partial` / `unpaid` payment statuses, all with future event dates | Imported: **8** · Skipped: **0** · Failed: **0** → step pill flips to **Done** |

After step 3, all three pills should be green and re-uploading any of
the three files should report **Skipped: N** (idempotency check —
the natural keys `(orgId, email)`, `(orgId, sku)`, `(orgId, externalRef)`
prevent duplicates).

### Things this happy path exercises

- **Quoted cells with embedded commas** — David Nguyen's address
  (`"Suite 5, 200 William Street"`) and tag cells like `"VIP,regular"`.
- **Apostrophes in cells** — Michael O'Brien's last name.
- **Optional fields left blank** — Sarah has no `phone`, Mia has no
  `notes` or `tags`, several products have no `safety_notes`.
- **Optional SKU** — Snow Machine (row 9) has an empty `sku` cell;
  it should still import successfully but won't be referenceable
  from a future bookings line-item import.
- **Boolean parsing** — `power_required` uses `yes` / `no`.
- **Decimal parsing** — `daily_rate`, `weekly_rate`, dimensions, and
  every booking total use 2-decimal Decimal columns.
- **Date parsing** — booking `event_date` uses ISO `YYYY-MM-DD`.
- **Time parsing** — `event_start_time` / `event_end_time` use 24h
  `HH:MM`. Some bookings (Michael's) leave them blank.
- **Computed `balance_due`** — every booking should land with
  `balance_due = subtotal - deposit_paid` (e.g. row 1: `650 − 200 = 450`).

## The error path (run after the happy path)

| File                           | What it does                                                                 |
|--------------------------------|------------------------------------------------------------------------------|
| `customers_with_errors.csv`    | 6 customer rows that exercise every row-level error code the importer emits  |

Expected outcome when you drop this file on the **Customers** card:

- Status: **Completed** (because at least one row landed) **OR** Failed
  (if the page treats >0 errors as failed — depends on how you decide to
  surface partial-success in the UI)
- Imported: **2** (Charlie row 5, Frank row 7)
- Skipped: **0**
- Failed: **4**
- Errors:
  - Row 2 — `VALIDATION_ERROR` on `first_name` (required, can't be empty)
  - Row 3 — `VALIDATION_ERROR` on `email` (`"not-an-email"` fails the email regex)
  - Row 4 — `VALIDATION_ERROR` on `email` (required, can't be empty)
  - Row 6 — `DUPLICATE_IN_FILE` on `email` (`charlie@example.com` already used on row 5)

> Row numbers in the error report are **spreadsheet row numbers** —
> row 1 is the header, row 2 is the first data row.

## Idempotency check

After importing `customers.csv` once, drop the **same file** on the
Customers card a second time. You should see:

- Imported: **0**
- Skipped: **8** (every row matched an existing `(orgId, email)` key)
- Failed: **0**

No duplicate customers in the database. Same applies to `products.csv`
(skipped on `(orgId, sku)`) and `bookings.csv` (skipped on `(orgId,
external_ref)`).

## Pre-validation rejection

To see the pre-validation rejection branch (where the whole file is
rejected before any row is processed), try one of these:

| Test                            | How                                                                | Expected error code              |
|---------------------------------|--------------------------------------------------------------------|----------------------------------|
| Wrong file extension            | Rename `customers.csv` to `customers.txt` and upload               | `INVALID_FILE_TYPE` (400)        |
| Missing required header         | Open `customers.csv`, delete the `email` column entirely, save     | `MISSING_REQUIRED_HEADERS` (422) |
| Unknown header                  | Add a `salary` column to `customers.csv`, save                     | `UNKNOWN_HEADERS` (422)          |
| Empty file                      | Upload an empty `.csv`                                             | `EMPTY_FILE` (422)               |
| Header row only (no data rows)  | Upload `customers.csv` with every data row deleted                 | `EMPTY_FILE` (422)               |

In every pre-validation case the page should:

- Flip the step's status pill to **Failed**
- Show the failure reason in a toast
- Persist a `FAILED` `ImportJob` row (visible via `GET /api/orgs/current/import/status`)

## Excel users

If you open these in Excel and re-save as CSV, watch out for two things:

1. **UTF-8 encoding.** Use **Save As → CSV UTF-8 (Comma delimited)
   (.csv)**. The plain "CSV (Comma delimited)" option saves as
   Windows-1252 and the importer will reject it.
2. **Phone numbers.** Excel sometimes strips the leading zero off
   `0412 345 678` and turns it into `412345678`. Format the column as
   **Text** before pasting if you're editing.
