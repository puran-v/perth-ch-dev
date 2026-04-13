"use client";

/**
 * Field Mapping Guide modal — opened from each step card on the CSV
 * Import page. Three tabs:
 *
 *   1. Field Reference   — every CSV column the platform expects, with
 *                          required / type / notes per column.
 *   2. Example CSV       — a copy-pasteable preview of a correctly
 *                          formatted file.
 *   3. Validation Rules  — error / warning / note callouts the
 *                          backend will enforce on import.
 *
 * V1 ships the Customers guide fully populated from the Figma. The
 * Products and Bookings guides render an empty-state message until
 * the design / data lands.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */

// Author: samir
// Impact: net-new modal — opened by every "View Mapping Guide" button on
//         the CSV Import page; uses the shared Modal primitive's new
//         headerAction slot for the Download template CSV button.
// Reason: client provided 3 Figma screenshots (one per tab); the page
//         already has the trigger buttons, this file owns the destination.

import { useCallback, useState } from "react";
import { toast } from "react-toastify";
import Button from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type {
  MappingGuide,
  StepKind,
  ValidationRuleSeverity,
} from "@/types/csv-import";

// ---------------------------------------------------------------------------
// Static labels + mapping guide data
// ---------------------------------------------------------------------------

/** Title-case label rendered in the modal title. */
const STEP_LABELS: Record<StepKind, string> = {
  customers: "Customers",
  products: "Products",
  bookings: "Bookings",
};

/** Singular noun used in the subtitle copy ("...customer fields..."). */
const STEP_NOUNS: Record<StepKind, string> = {
  customers: "customer",
  products: "product",
  bookings: "booking",
};

/**
 * Customer mapping guide — values match the Figma 1:1. When the real
 * import jobs API lands, swap this constant for a `useApiQuery` on
 * `/api/import/mapping-guide/customers` (or similar) and the modal
 * body stays unchanged.
 */
const CUSTOMER_GUIDE: MappingGuide = {
  fields: [
    { column: "first_name", mapsTo: "First Name", required: true, type: "Text", notes: "Customer first name" },
    { column: "last_name", mapsTo: "Last Name", required: true, type: "Text", notes: "Customer last name" },
    { column: "email", mapsTo: "Email", required: true, type: "Email", notes: "Used as unique identifier — duplicates are skipped" },
    { column: "phone", mapsTo: "Phone", required: false, type: "Text", notes: "Any format accepted, stored as entered" },
    { column: "mobile", mapsTo: "Mobile", required: false, type: "Text", notes: "Alternative phone field" },
    { column: "company", mapsTo: "Company/Org", required: false, type: "Text", notes: "For corporate customers" },
    { column: "address_line1", mapsTo: "Street Address", required: false, type: "Text", notes: "Street number and name" },
    { column: "address_suburb", mapsTo: "Suburb", required: false, type: "Text", notes: "—" },
    { column: "address_state", mapsTo: "State", required: false, type: "Text", notes: "e.g. WA, NSW, VIC" },
    { column: "address_postcode", mapsTo: "Postcode", required: false, type: "Text", notes: "—" },
    { column: "notes", mapsTo: "Customer Notes", required: false, type: "Text", notes: "Internal notes — not visible to customer" },
    { column: "tags", mapsTo: "Tags", required: false, type: "Text", notes: "Comma-separated, e.g. VIP,regular,school" },
  ],
  example: {
    filename: "example_customers.csv",
    headers: ["first_name", "last_name", "email", "phone", "company"],
    rows: [
      ["Sarah", "Johnson", "sarah.j@email.com", "0412 345 678", ""],
      ["James", "Williams", "james@acme.com.au", "08 9111 2222", "Acme Corp"],
      ["Emily", "Chen", "emily.chen@email.com", "0498 765 432", ""],
    ],
    footerNote:
      "The first row must be the column headers exactly as shown. Column order does not matter — the system maps by header name, not position.",
  },
  rules: [
    { severity: "error", message: "Email is required and must be unique" },
    { severity: "warning", message: "Duplicate emails are detected and skipped — existing customer record is not overwritten" },
    { severity: "error", message: "First name and last name are both required" },
    { severity: "note", message: "Phone numbers are stored as-is — no formatting applied" },
    { severity: "note", message: "Tags must be comma-separated within the cell, no extra spaces" },
    { severity: "note", message: "Maximum 10,000 rows per import file" },
    { severity: "warning", message: "File must be UTF-8 encoded — export from ERS as UTF-8 CSV" },
  ],
  rulesFooterNote:
    "After uploading, the system will show you a full import results report: total rows processed, rows imported successfully, rows skipped with reasons, and a downloadable error log for rows that failed.",
};

/**
 * Products mapping guide. Schema columns mirror prisma `Product` 1:1 so
 * the importer accepts whatever the user copies straight from this list.
 */
const PRODUCT_GUIDE: MappingGuide = {
  fields: [
    { column: "name", mapsTo: "Name", required: true, type: "Text", notes: "Product display name (e.g. \"Castle Combo XL\")" },
    { column: "daily_rate", mapsTo: "Daily Rate", required: true, type: "Number", notes: "Base hire rate per day, max 2 decimals (e.g. 250.00)" },
    { column: "sku", mapsTo: "SKU", required: false, type: "Text", notes: "Unique per org. Bookings reference products by SKU on import — set this to use the bookings flow." },
    { column: "category", mapsTo: "Category", required: false, type: "Text", notes: "Free-form, e.g. \"Bouncy Castles\", \"Slides\", \"Marquees\"" },
    { column: "description", mapsTo: "Description", required: false, type: "Text", notes: "Marketing copy shown on quotes" },
    { column: "weekly_rate", mapsTo: "Weekly Rate", required: false, type: "Number", notes: "Optional discounted weekly hire" },
    { column: "total_quantity", mapsTo: "Total Quantity", required: false, type: "Number", notes: "How many units you own. Defaults to 1 if blank." },
    { column: "weight_kg", mapsTo: "Weight (kg)", required: false, type: "Number", notes: "Used by the scheduling tool for vehicle loading" },
    { column: "length_cm", mapsTo: "Length (cm)", required: false, type: "Number", notes: "—" },
    { column: "width_cm", mapsTo: "Width (cm)", required: false, type: "Number", notes: "—" },
    { column: "height_cm", mapsTo: "Height (cm)", required: false, type: "Number", notes: "—" },
    { column: "setup_minutes", mapsTo: "Setup Minutes", required: false, type: "Number", notes: "Average setup time at site" },
    { column: "packdown_minutes", mapsTo: "Packdown Minutes", required: false, type: "Number", notes: "Average packdown time at site" },
    { column: "power_required", mapsTo: "Power Required", required: false, type: "Boolean", notes: "Accepts yes/no, true/false, or 1/0" },
    { column: "age_group_min", mapsTo: "Min Age", required: false, type: "Number", notes: "Minimum recommended age" },
    { column: "age_group_max", mapsTo: "Max Age", required: false, type: "Number", notes: "Maximum recommended age (must be ≥ min)" },
    { column: "max_occupancy", mapsTo: "Max Occupancy", required: false, type: "Number", notes: "How many users at once" },
    { column: "safety_notes", mapsTo: "Safety Notes", required: false, type: "Text", notes: "Internal hazards / risk notes" },
    { column: "tags", mapsTo: "Tags", required: false, type: "Text", notes: "Comma-separated, e.g. featured,kids,birthday" },
  ],
  example: {
    filename: "example_products.csv",
    headers: ["sku", "name", "category", "daily_rate", "total_quantity", "tags"],
    rows: [
      ["BCH-001", "Castle Combo XL", "Bouncy Castles", "250.00", "3", "featured,kids"],
      ["SLD-014", "Triple Lane Slide", "Slides", "320.00", "1", "featured"],
      ["MRQ-006", "6m Marquee", "Marquees", "180.00", "5", ""],
    ],
    footerNote:
      "The first row must be the column headers exactly as shown. Column order does not matter — the system maps by header name, not position.",
  },
  rules: [
    { severity: "error", message: "Name and daily_rate are required on every row" },
    { severity: "error", message: "daily_rate, weekly_rate and dimensions must be positive numbers with at most 2 decimal places" },
    { severity: "warning", message: "Re-importing a product with the same SKU is skipped — existing record is not overwritten" },
    { severity: "note", message: "Products without a SKU CAN'T be referenced from a bookings import — set a SKU first" },
    { severity: "note", message: "power_required accepts yes/no, true/false, or 1/0 (case-insensitive)" },
    { severity: "note", message: "Maximum 10,000 rows per import file" },
    { severity: "warning", message: "File must be UTF-8 encoded — export from ERS as UTF-8 CSV" },
  ],
  rulesFooterNote:
    "After uploading, the system will show you a full import results report: total rows processed, rows imported successfully, rows skipped with reasons, and a downloadable error log for rows that failed.",
};

/**
 * Bookings mapping guide. V1 is header-only — line items are NOT
 * imported through CSV (add them via the booking edit screen after
 * import). The note below makes that explicit.
 */
const BOOKING_GUIDE: MappingGuide = {
  fields: [
    { column: "external_ref", mapsTo: "ERS Reference", required: true, type: "Text", notes: "Unique per org — used to match the legacy ERS booking" },
    { column: "customer_email", mapsTo: "Customer Email", required: true, type: "Email", notes: "Must match an existing customer in this org. Import customers first." },
    { column: "event_date", mapsTo: "Event Date", required: true, type: "Date", notes: "ISO format YYYY-MM-DD" },
    { column: "delivery_address", mapsTo: "Delivery Address", required: true, type: "Text", notes: "Street number and name" },
    { column: "subtotal", mapsTo: "Subtotal", required: true, type: "Number", notes: "Total amount the customer was billed (max 2 decimals)" },
    { column: "event_start_time", mapsTo: "Start Time", required: false, type: "Text", notes: "24h HH:MM, e.g. 09:30" },
    { column: "event_end_time", mapsTo: "End Time", required: false, type: "Text", notes: "24h HH:MM, must be after start time" },
    { column: "delivery_suburb", mapsTo: "Suburb", required: false, type: "Text", notes: "—" },
    { column: "delivery_state", mapsTo: "State", required: false, type: "Text", notes: "e.g. WA, NSW, VIC" },
    { column: "delivery_postcode", mapsTo: "Postcode", required: false, type: "Text", notes: "—" },
    { column: "contact_phone", mapsTo: "Contact Phone", required: false, type: "Text", notes: "Best phone for the day of the event" },
    { column: "deposit_paid", mapsTo: "Deposit Paid", required: false, type: "Number", notes: "Defaults to 0. balance_due is computed as subtotal − deposit_paid." },
    { column: "payment_status", mapsTo: "Payment Status", required: false, type: "Text", notes: "paid / partial / unpaid (case-insensitive). Defaults to unpaid." },
    { column: "special_instructions", mapsTo: "Special Instructions", required: false, type: "Text", notes: "Customer-facing notes for the delivery team" },
    { column: "notes", mapsTo: "Internal Notes", required: false, type: "Text", notes: "Internal notes — not visible to customer" },
  ],
  example: {
    filename: "example_bookings.csv",
    headers: [
      "external_ref",
      "customer_email",
      "event_date",
      "delivery_address",
      "subtotal",
      "deposit_paid",
      "payment_status",
    ],
    rows: [
      ["ERS-12001", "sarah.j@email.com", "2026-05-12", "12 Beach Rd, Cottesloe", "650.00", "200.00", "partial"],
      ["ERS-12002", "james@acme.com.au", "2026-05-18", "44 Park Lane, Subiaco", "1200.00", "1200.00", "paid"],
      ["ERS-12003", "emily.chen@email.com", "2026-06-01", "9 Hilltop Ave, Joondalup", "480.00", "0", "unpaid"],
    ],
    footerNote:
      "The first row must be the column headers exactly as shown. Column order does not matter — the system maps by header name, not position.",
  },
  rules: [
    { severity: "error", message: "external_ref, customer_email, event_date, delivery_address and subtotal are required on every row" },
    { severity: "error", message: "customer_email must match an existing customer in this org — import customers first" },
    { severity: "warning", message: "Re-importing a booking with the same external_ref is skipped — existing record is not overwritten" },
    { severity: "note", message: "Line items are NOT imported through CSV — V1 stores the booking header (subtotal, dates, customer) only. Add line items via the booking edit screen after import." },
    { severity: "note", message: "balance_due is computed automatically as subtotal − deposit_paid" },
    { severity: "note", message: "Maximum 10,000 rows per import file" },
    { severity: "warning", message: "File must be UTF-8 encoded — export from ERS as UTF-8 CSV" },
  ],
  rulesFooterNote:
    "After uploading, the system will show you a full import results report: total rows processed, rows imported successfully, rows skipped with reasons, and a downloadable error log for rows that failed.",
};

const MAPPING_GUIDES: Record<StepKind, MappingGuide> = {
  customers: CUSTOMER_GUIDE,
  products: PRODUCT_GUIDE,
  bookings: BOOKING_GUIDE,
};

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type TabId = "field-ref" | "example" | "validation";

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: "field-ref", label: "Field Reference" },
  { id: "example", label: "Example CSV" },
  { id: "validation", label: "Validation Rules" },
];

// ---------------------------------------------------------------------------
// Modal entry
// ---------------------------------------------------------------------------

interface CsvMappingGuideModalProps {
  open: boolean;
  onClose: () => void;
  stepKind: StepKind;
}

/**
 * Renders the Field Mapping Guide modal for a given step. Wraps the
 * shared Modal primitive and uses its headerAction slot for the
 * Download template CSV button.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */
export function CsvMappingGuideModal({
  open,
  onClose,
  stepKind,
}: CsvMappingGuideModalProps) {
  const guide = MAPPING_GUIDES[stepKind];
  const stepLabel = STEP_LABELS[stepKind];
  const stepNoun = STEP_NOUNS[stepKind];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Field Mapping Guide - ${stepLabel}`}
      description={`Maps your ERS CSV columns to ${stepNoun} fields in the platform`}
      headerAction={
        // Author: samir
        // Impact: real <a download> hitting the templates endpoint
        // Reason: GET /api/orgs/current/import/templates/[kind] returns the
        //         header-only CSV with Content-Disposition: attachment, so the
        //         browser triggers a normal download with no JS plumbing.
        <a
          href={`/api/orgs/current/import/templates/${stepKind}`}
          download
          className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-[#1a2f6e] px-4 text-sm font-medium text-[#1a2f6e] transition-colors hover:bg-[#1a2f6e]/5 active:bg-[#1a2f6e]/10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a2f6e]/40"
        >
          Download template CSV
        </a>
      }
    >
      <ModalBody guide={guide} stepLabel={stepLabel} />
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Modal body — tab bar + active tab content
// ---------------------------------------------------------------------------

/**
 * Tab bar + the currently selected tab's content. Local state resets
 * on close because the parent Modal returns null when `open === false`,
 * which unmounts everything inside.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */
function ModalBody({
  guide,
  stepLabel,
}: {
  guide: MappingGuide;
  stepLabel: string;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("field-ref");

  return (
    <div className="flex flex-col gap-4">
      <TabBar active={activeTab} onChange={setActiveTab} />
      {activeTab === "field-ref" && (
        <FieldReferenceTab guide={guide} stepLabel={stepLabel} />
      )}
      {activeTab === "example" && (
        <ExampleCsvTab guide={guide} stepLabel={stepLabel} />
      )}
      {activeTab === "validation" && (
        <ValidationRulesTab guide={guide} stepLabel={stepLabel} />
      )}
    </div>
  );
}

/**
 * Pill-style tab bar matching the Team & Users page tab pattern.
 * Active tab uses a dark filled pill, inactive tabs are plain text.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */
function TabBar({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (id: TabId) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Mapping guide sections"
      className="flex flex-wrap gap-1.5 sm:gap-2"
    >
      {TABS.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={[
              "inline-flex items-center justify-center rounded-full h-9 px-4 text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F172A]/40",
              isActive
                ? "bg-[#0F172A] text-white shadow-sm"
                : "bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800",
            ].join(" ")}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab — Field Reference
// ---------------------------------------------------------------------------

/**
 * Renders the field reference table — one row per CSV column with
 * REQUIRED + TYPE + NOTES. Falls back to an empty state when the guide
 * has no fields (Products / Bookings until their data lands).
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */
function FieldReferenceTab({
  guide,
  stepLabel,
}: {
  guide: MappingGuide;
  stepLabel: string;
}) {
  if (guide.fields.length === 0) {
    return (
      <EmptyTab
        message={`Field reference for ${stepLabel} is coming soon.`}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600">
        Use these column headers exactly in your CSV file. Required fields
        must be present — optional fields can be left blank or omitted.
      </p>

      {/* Author: samir */}
      {/* Impact: horizontal scroll wrapper so the 5-col table doesn't overflow on mobile */}
      {/* Reason: 5 columns × min readable cell width pushes past 320px easily */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr className="font-medium">
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-black">
                CSV Column Header
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-black">
                Maps To
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-black">
                Required
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-black">
                Type
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-black">
                Notes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {guide.fields.map((f) => (
              <tr key={f.column} className="font-normal">
                <td className="px-4 py-3 font-mono text-sm text-blue-600 whitespace-nowrap">
                  {f.column}
                </td>
                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                  {f.mapsTo}
                </td>
                <td
                  className={`px-4 py-3 text-sm whitespace-nowrap ${
                    f.required ? "text-red-500" : "text-slate-500"
                  }`}
                >
                  {f.required ? "Required" : "Optional"}
                </td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                  {f.type}
                </td>
                <td className="px-4 py-3 text-slate-500">{f.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab — Example CSV
// ---------------------------------------------------------------------------

/**
 * Renders the example CSV preview card with a Copy CSV action and the
 * "first row must be column headers" info banner from the Figma.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */
function ExampleCsvTab({
  guide,
  stepLabel,
}: {
  guide: MappingGuide;
  stepLabel: string;
}) {
  const { example } = guide;

  // Memoised so the button identity stays stable across re-renders
  // and we don't rebuild the CSV string on every keystroke (currently
  // moot, but cheap insurance for the future controlled-state version).
  const handleCopy = useCallback(async () => {
    if (example.headers.length === 0) return;
    const csv = [
      example.headers.join(","),
      ...example.rows.map((row) => row.map(escapeCsvCell).join(",")),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(csv);
      toast.success("CSV copied to clipboard.");
    } catch {
      // Older browsers / insecure contexts can deny clipboard access.
      toast.error("Could not copy CSV — try selecting it manually.");
    }
  }, [example.headers, example.rows]);

  if (example.headers.length === 0) {
    return (
      <EmptyTab message={`Example CSV for ${stepLabel} is coming soon.`} />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600">
        Example of a correctly formatted CSV file. Copy this structure and
        replace with your own data.
      </p>

      <div className="rounded-xl border border-slate-200 overflow-hidden">
        {/* Card header — filename + Copy button */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-white">
          <span className="text-sm font-medium text-slate-700 truncate">
            {example.filename}
          </span>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            Copy CSV
          </Button>
        </div>

        {/* Preview table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {example.headers.map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="px-4 py-3 text-left font-mono text-sm text-blue-600 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {example.rows.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {row.map((cell, cellIdx) => (
                    <td
                      key={cellIdx}
                      className="px-4 py-3 text-slate-700 whitespace-nowrap"
                    >
                      {cell || "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {example.footerNote && (
        <div
          role="note"
          className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3"
        >
          <span className="mt-0.5 shrink-0 text-blue-600" aria-hidden="true">
            <InfoCircleIcon />
          </span>
          <p className="text-sm font-medium text-blue-800">
            {example.footerNote}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Escapes a single CSV cell so commas, double-quotes, and newlines
 * round-trip through clipboard → spreadsheet without corrupting the
 * structure. Standard RFC 4180 escaping.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */
function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Tab — Validation Rules
// ---------------------------------------------------------------------------

/** Top label rendered inside each rule card, by severity. */
const SEVERITY_LABELS: Record<ValidationRuleSeverity, string> = {
  error: "ERROR — IMPORT REJECTED",
  warning: "WARNING — FLAGGED FOR REVIEW",
  note: "NOTE",
};

/** Per-severity styling for the bordered rule cards. */
const SEVERITY_STYLES: Record<
  ValidationRuleSeverity,
  { wrapper: string; label: string; body: string; icon: string }
> = {
  error: {
    wrapper: "border-red-300 bg-red-50",
    label: "text-red-700",
    body: "text-red-700",
    icon: "text-red-500",
  },
  warning: {
    wrapper: "border-amber-300 bg-amber-50",
    label: "text-amber-700",
    body: "text-amber-700",
    icon: "text-amber-500",
  },
  note: {
    wrapper: "border-blue-200 bg-blue-50",
    label: "text-blue-700",
    body: "text-blue-700",
    icon: "text-blue-500",
  },
};

/**
 * Renders the Validation Rules tab — vertical list of bordered cards
 * (error / warning / note) followed by an info paragraph about the
 * post-upload results report.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */
function ValidationRulesTab({
  guide,
  stepLabel,
}: {
  guide: MappingGuide;
  stepLabel: string;
}) {
  if (guide.rules.length === 0) {
    return (
      <EmptyTab
        message={`Validation rules for ${stepLabel} are coming soon.`}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600">
        The system validates every row before importing. Errors block the
        row entirely. Warnings import the row but flag it for your
        attention.
      </p>

      <ul className="flex flex-col gap-3">
        {guide.rules.map((rule, i) => {
          const styles = SEVERITY_STYLES[rule.severity];
          return (
            <li
              key={i}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${styles.wrapper}`}
            >
              <span
                className={`mt-0.5 shrink-0 ${styles.icon}`}
                aria-hidden="true"
              >
                <InfoCircleIcon />
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-xs font-bold uppercase tracking-wide ${styles.label}`}
                >
                  {SEVERITY_LABELS[rule.severity]}
                </p>
                <p className={`mt-1 text-sm ${styles.body}`}>{rule.message}</p>
              </div>
            </li>
          );
        })}
      </ul>

      {guide.rulesFooterNote && (
        <div
          role="note"
          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4"
        >
          <p className="text-sm text-slate-600">{guide.rulesFooterNote}</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared subcomponents
// ---------------------------------------------------------------------------

/**
 * Plain-bordered placeholder shown when a tab has no data yet (e.g.
 * Products / Bookings until their guides land).
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */
function EmptyTab({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-10 text-center">
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

/**
 * Filled circle "i" used inside the blue info banners and the
 * validation rule cards. Color is inherited from the parent so each
 * severity tier can tint it independently.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */
function InfoCircleIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 9V14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="10" cy="6.5" r="0.75" fill="currentColor" />
    </svg>
  );
}
