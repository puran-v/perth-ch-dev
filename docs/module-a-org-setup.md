# Feature: Org Setup (Module A)

## Overview

First-time onboarding for a new tenant. Captures the business information, warehouse location, payment/invoice settings, and branding that every downstream module (quoting, invoicing, scheduling, warehouse) depends on. Spans two pages today — `/dashboard/org-setup` (business + warehouse + payment) and `/dashboard/branding` (logo + brand colours + email sender identity) — and both persist through the single shared `/api/org-setup` endpoint.

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

Discriminated union on `mode`. Every section is **optional** in both modes because Module A is split across multiple pages that each own a subset of sections (org-setup → business + warehouse + payment, branding → branding, future → team/products/bundles/rules). The server requires at least one section to be present in complete mode.

```ts
// Draft — loose, partial, safe to save partially-filled work
{
  mode: "draft",
  business?:  Partial<BusinessFormData>,
  warehouse?: Partial<WarehouseFormData>,
  payment?:   Partial<PaymentFormData>,
  branding?:  Partial<BrandingFormData>,
}

// Complete — strict, runs full Zod schemas from @/lib/validation/org-setup
// At least one section must be present.
{
  mode: "complete",
  business?:  BusinessInfoInput,
  warehouse?: WarehouseLocationInput,
  payment?:   PaymentInvoiceInput,
  branding?:  BrandingInput,
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
    "branding":  { ... },
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
- **`org_setups`** — 1:1 with `organizations`, keyed by `orgId` (unique). Stores `business`, `warehouse`, `payment`, and `branding` as JSONB columns plus a `status` enum (`DRAFT` | `COMPLETE`). Follows the standard soft-delete + timestamps convention. The `branding` column was added in migration `20260406130405_add_org_setup_branding`.

## Parameters / Inputs

See the Zod schemas in `src/lib/validation/org-setup.ts`:

- `businessInfoSchema` — `businessName*`, `tradingName`, `abn` (11 digits when present), `gstRegistered` (`yes`|`no`), `email*`, `phone`, `address*`, `timezone*`, `currency*`
- `warehouseLocationSchema` — `warehouseAddresses*` (string array, at least one selected, max 20), `earliestStartTime*`, `latestReturnTime*` (both `HH:MM`, end > start refine). Until the `Warehouse` model is built, the form offers 3 static depot options (`perth-cbd`, `fremantle`, `joondalup`); the stored shape is already an array of identifiers so swapping in real data later is a drop-in change.
- `paymentInvoiceSchema` — `defaultPaymentTerms*`, `invoiceNumberPrefix*`, `invoiceStartingNumber*` (positive integer), `defaultDepositPercent*` (0–100), bank fields (optional), `autoApplyCreditCardSurcharge` toggle, conditional `surchargePercent` + `labelOnInvoice` when toggle is on
- `brandingSchema` — `logoDataUrl` (optional base64 data URL, ~2 MB cap, placeholder until real object storage), `primaryColor*` and `accentColor*` (hex codes — 3 or 6 digits), `fromName*`, `fromEmail*` (must be a valid email), `replyTo` (optional email). The logo is stored inline as a base64 data URL today; when an S3 / R2 upload endpoint lands it will return a URL string that the form stores in the same column — no schema change needed.
- `orgSetupSaveSchema` — discriminated union used by the API (`mode: draft` loose, `mode: complete` strict with at-least-one-section refine)

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

Both pages share the same query key (`['org-setup']`), the same `OrgSetupResponse` shape, the same `ApiError → toast` error path, and the same `useApiQuery + useApiMutation` + skeleton + retry UX.

- `src/app/(dashboard)/dashboard/org-setup/page.tsx`
  - Owns the business, warehouse, and payment sections.
  - Save Draft hits `mode: "draft"`, Save & Continue hits `mode: "complete"` and then `router.push('/dashboard/branding')`.
  - Each form exposes a `validate()` / `getFormData()` handle via `forwardRef` + `useImperativeHandle`. Save Draft calls `getFormData()`; Save & Continue calls `validate()` and aborts if any section returns `null`.

- `src/app/(dashboard)/dashboard/branding/page.tsx`
  - Owns the branding section only.
  - **Save** hits `mode: "draft"` (no navigation), **Next: Products** hits `mode: "complete"` and then `router.push('/dashboard/products')`.
  - The stepper card shows Org Info as completed when the previous page has been filled in (derived from the server response — `data.business` present or `status === 'COMPLETE'`), and Branding as current / completed based on whether the required branding fields are populated.
  - `BrandingForm` exposes the same `validate()` / `getFormData()` handle shape as the other Module A forms so the page keeps a consistent submit flow.

## Future Work

- Add a server-side audit log entry for every `OrgSetup` write (creation / mode transition). Currently only `logger.info` is emitted.
- Replace the `Organization.name` denormalization with a computed view once the business-info JSON shape stabilises.
- Expose a `GET /api/org-setup/history` endpoint that reads soft-deleted rows for compliance.
- **Branding — logo upload**: today the logo is stored inline as a base64 data URL in the `branding` JSONB column (capped at 2 MB). Swap this for a presigned-upload flow (S3 / R2) so the column only holds a URL string.
- **Branding — DNS verification**: the "Verify DNS" button is currently a stub that toasts "coming soon". Wire it to an internal API that resolves SPF / DKIM / DMARC records for the `fromEmail` domain and persists the result in `branding.dnsStatus`.
