/**
 * Zod validation schemas for the Org Setup module (Scope 1 — Module A).
 *
 * Shared between the client forms in src/components/admin/*Form.tsx and
 * the org-setup API route, so error messages stay consistent on both
 * sides of the wire (PROJECT_RULES.md §4.6 + §8.3).
 *
 * Lives under src/lib/validation (not src/server/lib/validation) because
 * zod-only schemas are safe to import into client bundles and the client
 * needs them for live form validation.
 *
 * @author samir
 * @created 2026-04-06
 * @module Module A - Org Setup
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Business Information
// ---------------------------------------------------------------------------

/**
 * ABN (Australian Business Number) — 11 digits, commonly displayed with
 * spaces every 2/3 digits. We strip whitespace before counting so both
 * "12345678901" and "12 345 678 901" validate.
 */
const abnRegex = /^\d{11}$/;

/** Validates Business Information form inputs. */
export const businessInfoSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(1, "Business name is required")
    .max(120, "Business name must be 120 characters or less"),
  tradingName: z
    .string()
    .trim()
    .max(120, "Trading name must be 120 characters or less")
    .optional()
    .or(z.literal("")),
  abn: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, ""))
    .refine((v) => v === "" || abnRegex.test(v), "ABN must be 11 digits")
    .optional()
    .or(z.literal("")),
  gstRegistered: z.enum(["yes", "no"], {
    message: "Select whether the business is GST registered",
  }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Business email is required")
    .email("Invalid email format")
    .max(254, "Email must be 254 characters or less"),
  phone: z
    .string()
    .trim()
    .max(32, "Phone must be 32 characters or less")
    .optional()
    .or(z.literal("")),
  address: z
    .string()
    .trim()
    .min(1, "Business address is required")
    .max(255, "Address must be 255 characters or less"),
  timezone: z
    .string()
    .trim()
    .min(1, "Timezone is required"),
  currency: z
    .string()
    .trim()
    .length(3, "Currency must be a 3-letter code"),
});

// ---------------------------------------------------------------------------
// Warehouse Location
// ---------------------------------------------------------------------------

/** 24h HH:MM format used by <input type="time"> and the custom TimePicker. */
const timeHHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// Author: samir
// Impact: warehouse address is now a multi-select (array) instead of a free-text single address
// Reason: tenants can operate out of multiple depots — the scheduling tool needs every warehouse ID to route runs from the right origin. For now the UI ships with 3 static options; when the Warehouse model is built we'll replace the array of strings with an array of warehouse IDs without changing this schema's shape.

/** Validates Warehouse Location form inputs. */
export const warehouseLocationSchema = z
  .object({
    warehouseAddresses: z
      .array(
        z
          .string()
          .trim()
          .min(1, "Warehouse address cannot be empty")
          .max(255, "Address must be 255 characters or less"),
      )
      .min(1, "Select at least one warehouse address")
      .max(20, "Too many warehouse addresses selected"),
    earliestStartTime: z
      .string()
      .regex(timeHHMM, "Earliest start time must be in HH:MM format"),
    latestReturnTime: z
      .string()
      .regex(timeHHMM, "Latest return time must be in HH:MM format"),
  })
  .refine(
    (v) => v.earliestStartTime < v.latestReturnTime,
    {
      message: "Latest return time must be after earliest start time",
      path: ["latestReturnTime"],
    }
  );

// ---------------------------------------------------------------------------
// Branding
// ---------------------------------------------------------------------------

// Author: samir
// Impact: validates the Branding card (logo, brand colours, email sender identity)
// Reason: Module A step 2 — these schemas are shared by the /dashboard/branding form and the /api/org-setup route, so any rule change lands in one place

/** Accepts either 3-digit or 6-digit hex codes with a leading `#`. */
const hexColorRegex = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

/**
 * Upper bound for the logo data URL (placeholder until real object
 * storage is wired up). A 2 MB PNG becomes ~2.67 MB after base64
 * expansion, and we give it a small buffer for the `data:image/...;base64,`
 * prefix — hence the 2.75 MB cap.
 */
const LOGO_DATA_URL_MAX_BYTES = 2_750_000;

/** Matches `data:image/<subtype>;base64,<payload>` exactly. */
const dataImageUrlRegex = /^data:image\/(png|jpe?g|svg\+xml|webp|gif);base64,[A-Za-z0-9+/=]+$/;

/** Validates Branding form inputs. */
export const brandingSchema = z.object({
  // Logo is optional because most customers will skip it on first save
  // and fill it in later. An empty string is accepted so the client can
  // "clear" the logo by sending "".
  logoDataUrl: z
    .string()
    .max(LOGO_DATA_URL_MAX_BYTES, "Logo must be 2 MB or less")
    .refine(
      (v) => v === "" || dataImageUrlRegex.test(v),
      "Logo must be an image file (PNG, JPG, SVG, WebP, or GIF)",
    )
    .optional()
    .or(z.literal("")),
  primaryColor: z
    .string()
    .trim()
    .regex(hexColorRegex, "Primary colour must be a valid hex code (e.g. #1A3C6E)"),
  accentColor: z
    .string()
    .trim()
    .regex(hexColorRegex, "Accent colour must be a valid hex code (e.g. #2563EB)"),
  fromName: z
    .string()
    .trim()
    .min(1, "From name is required")
    .max(120, "From name must be 120 characters or less"),
  fromEmail: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "From email is required")
    .email("Invalid from-email format")
    .max(254, "Email must be 254 characters or less"),
  replyTo: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "Email must be 254 characters or less")
    .refine(
      (v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      "Reply-to must be a valid email address",
    )
    .optional()
    .or(z.literal("")),
});

// ---------------------------------------------------------------------------
// Payment & Invoice Settings
// ---------------------------------------------------------------------------

const paymentTermsValues = [
  "net-7",
  "net-14",
  "net-30",
  "due-on-receipt",
  "before-event",
] as const;

/**
 * Parses a numeric string in the 0–100 range for percentage fields.
 * Accepts "30", "30.5", etc. Rejects empty strings, negatives, >100.
 */
const percentString = z
  .string()
  .trim()
  .refine((v) => v !== "", "Required")
  .refine((v) => !Number.isNaN(Number(v)), "Must be a number")
  .refine((v) => Number(v) >= 0 && Number(v) <= 100, "Must be between 0 and 100");

/** Validates Payment & Invoice Settings form inputs. */
export const paymentInvoiceSchema = z
  .object({
    defaultPaymentTerms: z.enum(paymentTermsValues, {
      message: "Select a valid payment term",
    }),
    invoiceNumberPrefix: z
      .string()
      .trim()
      .min(1, "Invoice number prefix is required")
      .max(10, "Prefix must be 10 characters or less"),
    invoiceStartingNumber: z
      .string()
      .trim()
      .refine((v) => /^\d+$/.test(v), "Starting number must be digits only")
      .refine((v) => Number(v) > 0, "Starting number must be greater than 0"),
    defaultDepositPercent: percentString,
    bankName: z
      .string()
      .trim()
      .max(120, "Bank name must be 120 characters or less")
      .optional()
      .or(z.literal("")),
    // BSB is a 6-digit Australian bank routing code, commonly shown as "000 000".
    bsb: z
      .string()
      .trim()
      .transform((v) => v.replace(/\s+/g, ""))
      .refine((v) => v === "" || /^\d{6}$/.test(v), "BSB must be 6 digits")
      .optional()
      .or(z.literal("")),
    accountNumber: z
      .string()
      .trim()
      .max(32, "Account number must be 32 characters or less")
      .optional()
      .or(z.literal("")),
    accountName: z
      .string()
      .trim()
      .max(120, "Account name must be 120 characters or less")
      .optional()
      .or(z.literal("")),
    autoApplyCreditCardSurcharge: z.boolean(),
    // When the toggle is on, surcharge % and label become required.
    // Validated conditionally via .superRefine below.
    surchargePercent: z.string().trim(),
    labelOnInvoice: z.string().trim(),
  })
  .superRefine((val, ctx) => {
    if (val.autoApplyCreditCardSurcharge) {
      // Surcharge percent — reuse the same 0..100 rules as deposit.
      const pct = percentString.safeParse(val.surchargePercent);
      if (!pct.success) {
        ctx.addIssue({
          code: "custom",
          path: ["surchargePercent"],
          message: pct.error.issues[0]?.message ?? "Surcharge % is required",
        });
      }
      if (val.labelOnInvoice.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["labelOnInvoice"],
          message: "Label on invoice is required when surcharge is enabled",
        });
      } else if (val.labelOnInvoice.length > 120) {
        ctx.addIssue({
          code: "custom",
          path: ["labelOnInvoice"],
          message: "Label must be 120 characters or less",
        });
      }
    }
  });

// ---------------------------------------------------------------------------
// Composite schema + inferred types
// ---------------------------------------------------------------------------

// Author: samir
// Impact: every section in the composite schema is now optional
// Reason: Module A is split across multiple pages (org-setup, branding, …) and each page only submits the sections it owns. The strict per-section schemas still run when a section IS present — optionality just means "this page didn't touch that section". A top-level refine guarantees at least one section is present so we never accept an empty save.

/** Top-level strict schema for any Module A section payload. */
export const orgSetupSchema = z
  .object({
    business: businessInfoSchema.optional(),
    warehouse: warehouseLocationSchema.optional(),
    payment: paymentInvoiceSchema.optional(),
    branding: brandingSchema.optional(),
  })
  .refine(
    (v) => Boolean(v.business || v.warehouse || v.payment || v.branding),
    { message: "At least one section must be provided" },
  );

// Author: samir
// Impact: loose per-section schemas so drafts can carry whatever the user has typed so far
// Reason: the Save Draft button needs to round-trip partial/invalid data through the API
// without losing any keystrokes. We still cap size per field with a max(...) so a malicious
// client can't stuff megabytes into a JSON column. Unknown keys are stripped by Zod.
const draftStringField = z
  .string()
  .max(2048, "Field is too long")
  .optional();

const draftBooleanField = z.boolean().optional();

/** Draft-mode business block — every field optional and loosely typed. */
const draftBusinessSchema = z
  .object({
    businessName: draftStringField,
    tradingName: draftStringField,
    abn: draftStringField,
    gstRegistered: draftStringField,
    email: draftStringField,
    phone: draftStringField,
    address: draftStringField,
    timezone: draftStringField,
    currency: draftStringField,
  })
  .partial();

/** Draft-mode warehouse block — every field optional, addresses is a loose array. */
const draftWarehouseSchema = z
  .object({
    warehouseAddresses: z
      .array(z.string().max(255))
      .max(20, "Too many warehouse addresses selected")
      .optional(),
    earliestStartTime: draftStringField,
    latestReturnTime: draftStringField,
  })
  .partial();

/** Draft-mode payment block — every field optional, boolean toggle preserved. */
const draftPaymentSchema = z
  .object({
    defaultPaymentTerms: draftStringField,
    invoiceNumberPrefix: draftStringField,
    invoiceStartingNumber: draftStringField,
    defaultDepositPercent: draftStringField,
    bankName: draftStringField,
    bsb: draftStringField,
    accountNumber: draftStringField,
    accountName: draftStringField,
    autoApplyCreditCardSurcharge: draftBooleanField,
    surchargePercent: draftStringField,
    labelOnInvoice: draftStringField,
  })
  .partial();

/**
 * Draft-mode branding block — every field optional. The logo data URL
 * is still size-capped so a malicious client can't DoS the JSON column
 * with a 50 MB payload during draft saves.
 */
const draftBrandingSchema = z
  .object({
    logoDataUrl: z
      .string()
      .max(LOGO_DATA_URL_MAX_BYTES, "Logo must be 2 MB or less")
      .optional(),
    primaryColor: draftStringField,
    accentColor: draftStringField,
    fromName: draftStringField,
    fromEmail: draftStringField,
    replyTo: draftStringField,
  })
  .partial();

/**
 * Request body accepted by PUT /api/org-setup.
 *
 * Discriminated on `mode`:
 * - `draft`    → each section is optional + loosely typed. Safe for the
 *                Save Draft button, which should never block on validation.
 * - `complete` → each section is still optional (because Module A is split
 *                across multiple pages that each own a subset of sections)
 *                but the ones that ARE present run the strict schemas
 *                (refines + superRefine). The top-level refine guarantees
 *                at least one section is actually being submitted.
 *
 * Mirrors PROJECT_RULES.md §4.6 (validate every request) and §8.3 (client
 * + server validation).
 */
export const orgSetupSaveSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("draft"),
    business: draftBusinessSchema.optional(),
    warehouse: draftWarehouseSchema.optional(),
    payment: draftPaymentSchema.optional(),
    branding: draftBrandingSchema.optional(),
  }),
  z
    .object({
      mode: z.literal("complete"),
      business: businessInfoSchema.optional(),
      warehouse: warehouseLocationSchema.optional(),
      payment: paymentInvoiceSchema.optional(),
      branding: brandingSchema.optional(),
    })
    .refine(
      (v) => Boolean(v.business || v.warehouse || v.payment || v.branding),
      { message: "At least one section must be provided" },
    ),
]);

export type BusinessInfoInput = z.infer<typeof businessInfoSchema>;
export type WarehouseLocationInput = z.infer<typeof warehouseLocationSchema>;
export type PaymentInvoiceInput = z.infer<typeof paymentInvoiceSchema>;
export type BrandingInput = z.infer<typeof brandingSchema>;
export type OrgSetupInput = z.infer<typeof orgSetupSchema>;
export type OrgSetupSaveInput = z.infer<typeof orgSetupSaveSchema>;
export type OrgSetupDraftBusiness = z.infer<typeof draftBusinessSchema>;
export type OrgSetupDraftWarehouse = z.infer<typeof draftWarehouseSchema>;
export type OrgSetupDraftPayment = z.infer<typeof draftPaymentSchema>;
export type OrgSetupDraftBranding = z.infer<typeof draftBrandingSchema>;
