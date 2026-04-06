# Feature: Org Setup (Module A)

## Overview

First-time onboarding for a new tenant. Captures the business information, warehouse location, and payment/invoice settings that every downstream module (quoting, invoicing, scheduling, warehouse) depends on. Backs the `/dashboard/org-setup` page and its Save Draft + Save & Continue buttons.

## Flow

1. A user signs up (`POST /api/auth/signup`) and lands on `/dashboard/org-setup` with `user.orgId = null`.
2. The page calls `GET /api/org-setup` via `useApiQuery`. On a fresh account the response is `{ success: true, data: null }` and the forms render with empty defaults.
3. The user fills in one or more sections.
4. **Save Draft** (`PUT /api/org-setup` with `mode: "draft"`):
   - Client sends whatever the user has typed — no client-side validation.
   - Server validates with the loose `draftBusinessSchema` / `draftWarehouseSchema` / `draftPaymentSchema`.
   - If the user has no org yet, the server creates an `Organization` (name derived from `business.businessName` or `"${user.fullName}'s Organization"` fallback) and links it to `user.orgId` inside a single transaction.
   - Upserts an `OrgSetup` row keyed by `orgId`. Status stays `DRAFT` (or preserves an existing `COMPLETE` if the user is editing a completed setup).
   - Returns the saved row.
5. **Save & Continue** (`PUT /api/org-setup` with `mode: "complete"`):
   - Client runs the full strict Zod schemas via each form's `validate()` imperative handle. The first failing section blocks the request and shows a toast listing the failing sections.
   - On success the API receives the already-validated data and re-validates with the same schemas (defense in depth — never trust the client).
   - Same org auto-create logic as draft mode (covers the case where a user reaches complete mode without ever hitting Save Draft).
   - Sets `OrgSetup.status = COMPLETE`.
   - On HTTP 200 the client toasts success and `router.push('/dashboard/branding')` advances to the next stepper page.

## API Endpoints

| Method | Endpoint          | Description                                  | Auth Required | Permission            |
| ------ | ----------------- | -------------------------------------------- | ------------- | --------------------- |
| GET    | `/api/org-setup`  | Fetch the current setup for the caller's org | Yes           | `org.settings.read`   |
| PUT    | `/api/org-setup`  | Upsert draft or complete setup               | Yes           | `org.settings.write`  |

### Request body — `PUT /api/org-setup`

Discriminated union on `mode`:

```ts
// Draft — loose, partial, safe to save partially-filled work
{
  mode: "draft",
  business?:  Partial<BusinessFormData>,
  warehouse?: Partial<WarehouseFormData>,
  payment?:   Partial<PaymentFormData>,
}

// Complete — strict, runs full Zod schemas from @/lib/validation/org-setup
{
  mode: "complete",
  business:  BusinessInfoInput,
  warehouse: WarehouseLocationInput,
  payment:   PaymentInvoiceInput,
}
```

### Response — success

```json
{
  "success": true,
  "data": {
    "status": "DRAFT",
    "business":  { ... },
    "warehouse": { ... },
    "payment":   { ... },
    "updatedAt": "2026-04-06T12:34:56.000Z"
  }
}
```

Or `data: null` (GET only) when no setup has been saved yet.

### Response — error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check your input and try again.",
    "details": [
      { "field": "business.email", "message": "Invalid email format" }
    ]
  }
}
```

## Database Tables Involved

- **`organizations`** — created on first save if the user had no org. `name` kept in sync with `business.businessName` on every write.
- **`users`** — `orgId` backfilled during first save. Done inside a transaction with the `organizations` insert.
- **`org_setups`** — 1:1 with `organizations`, keyed by `orgId` (unique). Stores `business`, `warehouse`, `payment` as JSONB columns plus a `status` enum (`DRAFT` | `COMPLETE`). Follows the standard soft-delete + timestamps convention.

## Parameters / Inputs

See the Zod schemas in `src/lib/validation/org-setup.ts`:

- `businessInfoSchema` — `businessName*`, `tradingName`, `abn` (11 digits when present), `gstRegistered` (`yes`|`no`), `email*`, `phone`, `address*`, `timezone*`, `currency*`
- `warehouseLocationSchema` — `warehouseAddress*`, `earliestStartTime*`, `latestReturnTime*` (both `HH:MM`, end > start refine)
- `paymentInvoiceSchema` — `defaultPaymentTerms*`, `invoiceNumberPrefix*`, `invoiceStartingNumber*` (positive integer), `defaultDepositPercent*` (0–100), bank fields (optional), `autoApplyCreditCardSurcharge` toggle, conditional `surchargePercent` + `labelOnInvoice` when toggle is on
- `orgSetupSaveSchema` — discriminated union used by the API (`mode: draft` loose, `mode: complete` strict)

## Business Rules

- Every query on `org_setups` **MUST** be scoped by `orgId` from the authenticated session (§2.1). `orgId` is never accepted from the request body.
- The org-setup route is the only endpoint in the app that may create an Organization for a logged-in user. It therefore uses `requireAuth` (not `requireOrg`). Every other route should continue to use `requireOrg` as per PROJECT_RULES §6.3.
- `OrgSetup.business` is the source of truth for business details. `Organization.name` is a denormalized copy kept in sync on every save for list/display convenience. Do not read business info from `Organization.name`.
- `OrgSetupStatus` never downgrades on draft writes. A user editing an already-completed setup keeps `COMPLETE` until they explicitly re-save via Save & Continue.
- Session-scoped cache: both GET and PUT responses set `Cache-Control: private, no-store`. Do not cache at a CDN / shared proxy.

## Permissions

- `org.settings.read` — GET
- `org.settings.write` — PUT

Both are granted to `ADMIN` by default via the wildcard in `ROLE_PERMISSIONS`. `MANAGER`, `STAFF`, and `DRIVER` do not have access.

## Error Scenarios

| Condition                              | HTTP | Code               |
| -------------------------------------- | ---- | ------------------ |
| No session cookie / expired session    | 401  | `UNAUTHORIZED`     |
| Authenticated but lacks org.settings.* | 403  | `FORBIDDEN`        |
| Request body is not valid JSON         | 400  | `INVALID_JSON`     |
| Zod schema fails                       | 400  | `VALIDATION_ERROR` (with per-field `details[]`) |
| Unexpected DB / server failure         | 500  | `INTERNAL_ERROR`   |

## AI Integration

None in this feature. Module A AI (sales-ai) lives elsewhere and does not read or write org setup.

## Client Integration

- `src/app/(dashboard)/dashboard/org-setup/page.tsx`
  - `useApiQuery(['org-setup'], '/api/org-setup')` loads the saved setup.
  - `useApiMutation('/api/org-setup', 'put', { invalidateKeys: [['org-setup']] })` powers both buttons.
  - Forms are gated behind the loading state — the page renders a skeleton while the initial GET is in flight so `initialData` is always present when forms mount (the form components read `initialData` only once via `useState`).
  - Each form exposes a `validate()` / `getFormData()` handle via `forwardRef` + `useImperativeHandle`. Save Draft calls `getFormData()`; Save & Continue calls `validate()` and aborts if any section returns `null`.

## Future Work

- Add a server-side audit log entry for every `OrgSetup` write (creation / mode transition). Currently only `logger.info` is emitted.
- Replace the `Organization.name` denormalization with a computed view once the business-info JSON shape stabilises.
- Expose a `GET /api/org-setup/history` endpoint that reads soft-deleted rows for compliance.
