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

/** Validates Warehouse Location form inputs. */
export const warehouseLocationSchema = z
  .object({
    warehouseAddress: z
      .string()
      .trim()
      .min(1, "Warehouse address is required")
      .max(255, "Address must be 255 characters or less"),
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

/** Top-level payload accepted by the org-setup save endpoint. */
export const orgSetupSchema = z.object({
  business: businessInfoSchema,
  warehouse: warehouseLocationSchema,
  payment: paymentInvoiceSchema,
});

export type BusinessInfoInput = z.infer<typeof businessInfoSchema>;
export type WarehouseLocationInput = z.infer<typeof warehouseLocationSchema>;
export type PaymentInvoiceInput = z.infer<typeof paymentInvoiceSchema>;
export type OrgSetupInput = z.infer<typeof orgSetupSchema>;
