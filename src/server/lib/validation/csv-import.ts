/**
 * Zod schemas for the CSV Import flow (Module A).
 *
 * Two layers per import kind:
 *   1. headerSchema  — exact list of expected headers (set equality, order
 *                      doesn't matter — the parser maps by name)
 *   2. rowSchema     — strict per-row validation; passing a row through this
 *                      yields a typed object ready for the DB inserter
 *
 * Per PROJECT_RULES §4.6: every API route MUST validate input with Zod.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */

// Author: samir
// Impact: net-new validation module for the three import kinds
// Reason: csv_design.md spec spells out the headers + per-row rules; this
//         file is the single source of truth, shared by:
//           - the multipart route handler (POST /import/:kind)
//           - the per-kind importer functions in src/server/lib/csv-import/
//           - the FE mapping guide modal (via the same field constants)

import { z } from "zod";

// ---------------------------------------------------------------------------
// Constants — referenced by the parser, importer, and FE mapping guides
// ---------------------------------------------------------------------------

/** Maximum rows per CSV file (excluding the header row). */
export const MAX_IMPORT_ROWS = 10_000;

/**
 * Hard upload size cap. Sized to ~5x the realistic worst case (10k rows ×
 * ~10 columns × ~50 bytes = ~5 MB) so a malicious client can't ship a
 * 100 MB CSV through the multipart endpoint and OOM the server.
 */
export const MAX_IMPORT_FILE_BYTES = 25 * 1024 * 1024;

/**
 * RFC-compatible-enough email regex. Matches the team validation rule
 * so a customer email accepted on the team page is also accepted here.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** ISO date YYYY-MM-DD strict — Postgres `Date` column drops the time anyway. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 24-hour HH:MM strict, used by booking event start/end times. */
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

/** Required + optional headers for the customers CSV. */
export const CUSTOMER_HEADERS = {
  required: ["first_name", "last_name", "email"] as const,
  optional: [
    "phone",
    "mobile",
    "company",
    "address_line1",
    "address_suburb",
    "address_state",
    "address_postcode",
    "notes",
    "tags",
  ] as const,
};

/**
 * Strict per-row schema for a customers import. Empty optional cells are
 * normalised to `null` so the inserter can write them as NULL columns
 * instead of empty strings (cleaner downstream queries).
 */
export const customerRowSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(120),
  last_name: z.string().trim().min(1, "Last name is required").max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Email is required")
    .max(254)
    .refine((v) => EMAIL_RE.test(v), "Invalid email format"),
  phone: z.string().trim().max(32).optional().nullable(),
  mobile: z.string().trim().max(32).optional().nullable(),
  company: z.string().trim().max(160).optional().nullable(),
  address_line1: z.string().trim().max(255).optional().nullable(),
  address_suburb: z.string().trim().max(120).optional().nullable(),
  address_state: z.string().trim().max(64).optional().nullable(),
  address_postcode: z.string().trim().max(16).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  // Tags are a comma-separated string in the CSV cell — split + trim happens
  // in the parser, this schema accepts the resulting array.
  tags: z.array(z.string().trim().max(64)).max(20).optional().default([]),
});

export type CustomerRowInput = z.infer<typeof customerRowSchema>;

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export const PRODUCT_HEADERS = {
  required: ["name", "daily_rate"] as const,
  optional: [
    "sku",
    "category",
    "description",
    "weekly_rate",
    "total_quantity",
    "weight_kg",
    "length_cm",
    "width_cm",
    "height_cm",
    "setup_minutes",
    "packdown_minutes",
    "power_required",
    "age_group_min",
    "age_group_max",
    "max_occupancy",
    "safety_notes",
    "tags",
  ] as const,
};

/**
 * Helper that turns a CSV cell into an optional positive decimal.
 * Empty strings become `null`. Negative numbers and non-numerics fail.
 */
const optionalDecimal = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v === undefined || v === null || v === "" ? null : v))
  .refine((v) => v === null || /^\d+(\.\d{1,2})?$/.test(v), {
    message: "Must be a positive number with at most 2 decimal places",
  });

/** Helper for required positive decimals (e.g. dailyRate). */
const requiredDecimal = z
  .string()
  .trim()
  .min(1, "Required")
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), {
    message: "Must be a positive number with at most 2 decimal places",
  });

/** Helper for optional positive integers. */
const optionalInt = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v === undefined || v === null || v === "" ? null : v))
  .refine((v) => v === null || /^\d+$/.test(v), {
    message: "Must be a positive integer",
  });

/** Helper for optional booleans (accepts y/n, yes/no, true/false, 1/0). */
const optionalBoolean = z
  .string()
  .trim()
  .toLowerCase()
  .optional()
  .nullable()
  .transform((v) => {
    if (v === undefined || v === null || v === "") return false;
    if (["y", "yes", "true", "1"].includes(v)) return true;
    if (["n", "no", "false", "0"].includes(v)) return false;
    return undefined; // Triggers the refine below
  })
  .refine((v) => v !== undefined, {
    message: "Must be yes/no, true/false, or 1/0",
  });

export const productRowSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  daily_rate: requiredDecimal,
  sku: z.string().trim().max(64).optional().nullable(),
  category: z.string().trim().max(120).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  weekly_rate: optionalDecimal,
  total_quantity: optionalInt,
  weight_kg: optionalDecimal,
  length_cm: optionalDecimal,
  width_cm: optionalDecimal,
  height_cm: optionalDecimal,
  setup_minutes: optionalInt,
  packdown_minutes: optionalInt,
  power_required: optionalBoolean,
  age_group_min: optionalInt,
  age_group_max: optionalInt,
  max_occupancy: optionalInt,
  safety_notes: z.string().trim().max(2000).optional().nullable(),
  tags: z.array(z.string().trim().max(64)).max(20).optional().default([]),
});

export type ProductRowInput = z.infer<typeof productRowSchema>;

// ---------------------------------------------------------------------------
// Bookings (header-only for V1)
// ---------------------------------------------------------------------------

export const BOOKING_HEADERS = {
  required: [
    "external_ref",
    "customer_email",
    "event_date",
    "delivery_address",
    "subtotal",
  ] as const,
  optional: [
    "event_start_time",
    "event_end_time",
    "delivery_suburb",
    "delivery_state",
    "delivery_postcode",
    "contact_phone",
    "deposit_paid",
    "payment_status",
    "special_instructions",
    "notes",
  ] as const,
};

/** Accept paid/partial/unpaid in any case; normalise upstream. */
const paymentStatusInput = z
  .string()
  .trim()
  .toLowerCase()
  .optional()
  .nullable()
  .transform((v) => (v === undefined || v === null || v === "" ? "unpaid" : v))
  .refine((v) => ["paid", "partial", "unpaid"].includes(v), {
    message: "Must be one of: paid, partial, unpaid",
  });

export const bookingRowSchema = z.object({
  external_ref: z.string().trim().min(1, "External ref is required").max(64),
  customer_email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Customer email is required")
    .max(254)
    .refine((v) => EMAIL_RE.test(v), "Invalid email format"),
  event_date: z
    .string()
    .trim()
    .min(1, "Event date is required")
    .refine((v) => ISO_DATE_RE.test(v), "Event date must be ISO format YYYY-MM-DD"),
  event_start_time: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v === undefined || v === null || v === "" ? null : v))
    .refine((v) => v === null || HHMM_RE.test(v), {
      message: "Start time must be 24h HH:MM",
    }),
  event_end_time: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v === undefined || v === null || v === "" ? null : v))
    .refine((v) => v === null || HHMM_RE.test(v), {
      message: "End time must be 24h HH:MM",
    }),
  delivery_address: z.string().trim().min(1, "Delivery address is required").max(255),
  delivery_suburb: z.string().trim().max(120).optional().nullable(),
  delivery_state: z.string().trim().max(64).optional().nullable(),
  delivery_postcode: z.string().trim().max(16).optional().nullable(),
  contact_phone: z.string().trim().max(32).optional().nullable(),
  subtotal: requiredDecimal,
  deposit_paid: optionalDecimal,
  payment_status: paymentStatusInput,
  special_instructions: z.string().trim().max(2000).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export type BookingRowInput = z.infer<typeof bookingRowSchema>;
