/**
 * CSV Import — shared types for the Module A data migration UI.
 *
 * Lives in src/types/ so the page (csv-import/page.tsx), the mapping
 * guide modal (components/admin/CsvMappingGuideModal.tsx), and the
 * future API client all read from one source of truth instead of
 * re-declaring overlapping shapes.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */

// Author: samir
// Impact: hoists StepKind / StepStatus out of csv-import/page.tsx so the
//         mapping guide modal can consume them without importing from a
//         page route file (which would create a fragile dependency edge).
// Reason: project §3 places shared types under src/types/, sibling to
//         booking.ts / products.ts / inventory.ts.

/** Identifier for each of the three sequential import steps. */
export type StepKind = "customers" | "products" | "bookings";

/** Discrete states a CSV import step can be in. */
export type StepStatus = "done" | "pending" | "in_progress" | "failed";

/** Data type a CSV column is parsed as on import. */
export type FieldDataType = "Text" | "Email" | "Number" | "Date" | "Boolean";

/** One row in the Field Reference tab table. */
export interface FieldReference {
  /** CSV column header as it must appear in the file (e.g. "first_name"). */
  column: string;
  /** Friendly platform field name this column maps into (e.g. "First Name"). */
  mapsTo: string;
  /** When true, the column MUST be present and non-empty for the row. */
  required: boolean;
  /** Data type the column is parsed as. */
  type: FieldDataType;
  /** Free-form notes / examples shown in the rightmost column. */
  notes: string;
}

/** Pre-formatted example CSV shown on the Example CSV tab. */
export interface ExampleCsv {
  /** Filename rendered as the card header (e.g. "example_customers.csv"). */
  filename: string;
  /** Column headers — rendered as the first table row in the preview. */
  headers: string[];
  /**
   * Data rows. Each row's length should match the headers length;
   * empty strings render as a "—" dash placeholder so the table never
   * shows visual gaps.
   */
  rows: string[][];
  /** Optional info banner shown below the preview table. */
  footerNote?: string;
}

/** Severity tier for a validation rule shown on the Validation Rules tab. */
export type ValidationRuleSeverity = "error" | "warning" | "note";

/** One bordered row in the Validation Rules tab list. */
export interface ValidationRule {
  severity: ValidationRuleSeverity;
  /** Body text shown inside the bordered card. */
  message: string;
}

/** Full data bundle one import step exposes through its mapping guide. */
export interface MappingGuide {
  fields: FieldReference[];
  example: ExampleCsv;
  rules: ValidationRule[];
  /** Footer paragraph shown below the rules list (Validation Rules tab). */
  rulesFooterNote?: string;
}

// ---------------------------------------------------------------------------
// API wire types — shared by the routes and the React Query hooks
// Author: samir
// Impact: single source of truth for what the import endpoints return
// Reason: stops the FE hooks and the route handlers drifting apart on shape
// ---------------------------------------------------------------------------

/**
 * Wire-format of an ImportJob row. Lifted out of Prisma's generated
 * types so the FE bundle never accidentally pulls in `@/generated/prisma`.
 */
export interface ImportJobDto {
  id: string;
  kind: "CUSTOMERS" | "PRODUCTS" | "BOOKINGS";
  status: "RUNNING" | "COMPLETED" | "FAILED";
  filename: string;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  failedRows: number;
  failureReason: string | null;
  createdAt: string;
  completedAt: string | null;
}

/** GET /import/status — most-recent job per kind. */
export interface ImportStatusResponse {
  customers: ImportJobDto | null;
  products: ImportJobDto | null;
  bookings: ImportJobDto | null;
}

/** Per-row error returned alongside an import result. */
export interface ImportRowError {
  row: number;
  field?: string;
  code: string;
  message: string;
}

/**
 * POST /import/[kind] success body — the importer ran and at least one
 * row was attempted (status is COMPLETED or FAILED depending on whether
 * any row landed). Counts live at the top level (not nested under
 * `result`) so consumers don't have to dig two levels deep.
 */
export interface ImportRunResult {
  importJob: ImportJobDto;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  failedRows: number;
  errors: ImportRowError[];
}

/**
 * POST /import/[kind] 422 body — pre-validation rejection (wrong
 * headers, oversized, malformed). No rows were attempted.
 */
export interface ImportRunRejected {
  importJob: ImportJobDto;
  failureCode:
    | "EMPTY_FILE"
    | "FILE_TOO_LARGE"
    | "ROW_LIMIT_EXCEEDED"
    | "MISSING_REQUIRED_HEADERS"
    | "UNKNOWN_HEADERS"
    | "MALFORMED_CSV";
}

/** GET /import/jobs/[id] — single job detail with the full error log. */
export interface ImportJobDetail extends ImportJobDto {
  errors: ImportRowError[] | null;
}
