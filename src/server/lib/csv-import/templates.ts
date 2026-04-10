/**
 * CSV template generator — emits an empty header-only CSV per import kind
 * for the "Download template CSV" button on the CSV Import page and the
 * Field Mapping Guide modal.
 *
 * Single source of truth: pulls headers from the same constants the
 * parser validates against, so the template can never drift out of sync
 * with what the importer accepts.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */

// Author: samir
// Impact: server-side template builder used by GET /import/templates/[kind]
// Reason: shipping a static .csv file in /public would let it drift away
//         from the real header schema; generating from the validation
//         constants guarantees they stay in lockstep

import {
  BOOKING_HEADERS,
  CUSTOMER_HEADERS,
  PRODUCT_HEADERS,
} from "@/server/lib/validation/csv-import";

/** Identifier for one of the three import flows. */
export type TemplateKind = "customers" | "products" | "bookings";

/** Suggested filename for the response Content-Disposition. */
const FILENAMES: Record<TemplateKind, string> = {
  customers: "perthbch_customers_template.csv",
  products: "perthbch_products_template.csv",
  bookings: "perthbch_bookings_template.csv",
};

/** Header lists per kind, in stable user-facing order (required first). */
const HEADERS: Record<TemplateKind, ReadonlyArray<string>> = {
  customers: [...CUSTOMER_HEADERS.required, ...CUSTOMER_HEADERS.optional],
  products: [...PRODUCT_HEADERS.required, ...PRODUCT_HEADERS.optional],
  bookings: [...BOOKING_HEADERS.required, ...BOOKING_HEADERS.optional],
};

/**
 * Builds a header-only CSV string for the requested kind. The trailing
 * newline is intentional — Excel sometimes ignores files without one.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */
export function buildTemplate(kind: TemplateKind): {
  filename: string;
  body: string;
} {
  const headers = HEADERS[kind];
  // Header row is plain comma-join — none of our header names contain
  // commas, quotes, or newlines so RFC-4180 escaping isn't needed.
  const body = `${headers.join(",")}\n`;
  return { filename: FILENAMES[kind], body };
}
