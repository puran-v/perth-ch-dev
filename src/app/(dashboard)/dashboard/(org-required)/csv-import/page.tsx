"use client";

/**
 * CSV Import page — one-time data migration UI for moving Customers,
 * Products, and Bookings from the legacy ERS system into the new
 * platform. Three sequential steps in the order required by the data
 * model: Customers → Products → Bookings (Bookings optional).
 *
 * V1 scope: presentational page only — drop zones accept .csv files
 * and surface a toast on selection, but the actual upload pipeline,
 * Mapping Guide modal, and backend job tracking are deliberately
 * out of scope for this PR. Status pills are driven by mock state
 * until the import jobs API lands.
 *
 * Wrapped in ModuleGuard so only org-roles with moduleA can reach it.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */

// Author: samir
// Impact: replaces the stub that just rendered an h1 + paragraph
// Reason: client provided the Figma for the CSV Import landing screen —
//         3 step cards (Customers / Products / Bookings) with drop zones,
//         a status pill, and per-step Download template / View Mapping
//         Guide actions. This file is the design build only; the upload
//         pipeline + modal land in a follow-up PR.

import { useCallback, useRef, useState } from "react";
import { toast } from "react-toastify";
import { ModuleGuard } from "@/components/auth/ModuleGuard";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
// Author: samir
// Impact: pulls the new Field Mapping Guide modal in so each StepCard's
//         "View Mapping Guide" button has somewhere to land
// Reason: client provided the modal Figma — modal lives in components/admin
//         so the page stays a thin composition.
import { CsvMappingGuideModal } from "@/components/admin/CsvMappingGuideModal";
// Old Author: samir
// New Author: samir
// Impact: replaced the hardcoded mock literals with the real status hook
//         + upload mutation now that the backend lives at /api/orgs/current/import
// Reason: csv_design.md backend pass — the page is no longer a design mock
import {
  deriveStepStatus,
  getJobForKind,
  useImportStatus,
} from "@/hooks/csv-import/useImportStatus";
import { useUploadCsv } from "@/hooks/csv-import/useUploadCsv";
import { ApiError } from "@/lib/api-client";
import type { StepKind, StepStatus } from "@/types/csv-import";

// ---------------------------------------------------------------------------
// Page entry
// ---------------------------------------------------------------------------

/**
 * Dashboard CSV Import landing page. Renders three import step cards in
 * a 2-column-then-full-width layout matching the Figma:
 *
 * ┌────────────┐  ┌────────────┐
 * │ Customers  │  │ Products   │
 * └────────────┘  └────────────┘
 * ┌──────────────────────────────┐
 * │ Upcoming Bookings            │
 * └──────────────────────────────┘
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */
export default function CsvImportPage() {
  return (
    <ModuleGuard module="A">
      <CsvImportContent />
    </ModuleGuard>
  );
}

/**
 * Inner page content. Split out so the ModuleGuard layer stays a thin
 * wrapper and we don't have to thread props through it.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */
function CsvImportContent() {
  // Author: samir
  // Impact: real status from the backend — replaces the mock literals
  // Reason: GET /api/orgs/current/import/status returns the latest job
  //         per kind; deriveStepStatus maps each one to a pill state
  const { data: importStatus } = useImportStatus();
  const customersStatus: StepStatus = deriveStepStatus(
    getJobForKind(importStatus, "customers"),
  );
  const productsStatus: StepStatus = deriveStepStatus(
    getJobForKind(importStatus, "products"),
  );
  const bookingsStatus: StepStatus = deriveStepStatus(
    getJobForKind(importStatus, "bookings"),
  );

  // Single shared upload mutation — the per-card DropZone calls
  // mutateAsync so it can await the response and surface the right toast
  // (success / per-row errors / pre-validation rejection).
  const uploadMutation = useUploadCsv();

  // Author: samir
  // Impact: lifted modal state up so a single CsvMappingGuideModal instance
  //         is shared by all three StepCards
  // Reason: only one modal can be open at a time; mounting one per card
  //         would duplicate the backdrop + escape-key listener
  const [mappingGuideStep, setMappingGuideStep] = useState<StepKind | null>(
    null,
  );

  const openMappingGuide = useCallback((kind: StepKind) => {
    setMappingGuideStep(kind);
  }, []);

  const closeMappingGuide = useCallback(() => {
    setMappingGuideStep(null);
  }, []);

  /**
   * Hand-off from the dropzone — runs the upload mutation and surfaces
   * the right toast for each branch (server reject / per-row errors /
   * full success). Lives at the page level so the mutation result can
   * be awaited and the UI doesn't fork the toast logic per card.
   *
   * @author samir
   * @created 2026-04-09
   * @module Module A - CSV Import
   */
  const handleUpload = useCallback(
    async (kind: StepKind, file: File) => {
      try {
        const outcome = await uploadMutation.mutateAsync({ kind, file });

        if (outcome.ok === false) {
          // Pre-validation rejection — show the failure code in a toast
          toast.error(
            outcome.result.importJob.failureReason ??
              "The file was rejected before any rows were processed.",
          );
          return;
        }

        const { importedRows, skippedRows, failedRows, totalRows } = outcome.result;

        if (failedRows > 0 && importedRows === 0) {
          toast.error(
            `Import failed — ${failedRows} of ${totalRows} rows could not be processed. View errors for details.`,
          );
          return;
        }

        if (failedRows > 0) {
          toast.warning(
            `Imported ${importedRows} of ${totalRows} ${kind}. ${failedRows} rows failed and ${skippedRows} were skipped.`,
          );
          return;
        }

        if (skippedRows > 0) {
          toast.success(
            `Imported ${importedRows} of ${totalRows} ${kind}. ${skippedRows} duplicates skipped.`,
          );
          return;
        }

        toast.success(`Imported ${importedRows} ${kind} successfully.`);
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Upload failed. Please try again.";
        toast.error(message);
      }
    },
    [uploadMutation],
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Page heading — matches the in-page heading pattern used by
          Branding / Team / Org Setup pages so visual chrome is consistent
          across the dashboard. The outer sticky bar already renders the
          big "CSV Import" + date pair (see layout.tsx ROUTE_TITLES). */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">CSV Import</h1>
        <p className="mt-1 text-sm text-slate-600">
          Import your existing data from ERS. Run once during initial setup
          before going live.
        </p>
      </div>

      {/* Order-of-operations warning — amber banner that lives above the
          step cards. The order matters because Bookings reference both
          Customers and Products by id, so trying to import Bookings
          first would orphan every row. */}
      <ImportOrderBanner />

      {/* Steps 1 + 2 — paired side-by-side at md+, stacked on mobile.
          Bookings (step 3) is the full-width row below because its info
          banner needs the breathing room and matches the Figma. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <StepCard
          stepNumber={1}
          stepTitle="Customers"
          status={customersStatus}
          stepKind="customers"
          dropPlaceholder="Drop Customers CSV here"
          onOpenMappingGuide={openMappingGuide}
          onUpload={handleUpload}
          isUploading={
            uploadMutation.isPending && uploadMutation.variables?.kind === "customers"
          }
        />
        <StepCard
          stepNumber={2}
          stepTitle="Products"
          status={productsStatus}
          stepKind="products"
          dropPlaceholder="Drop Products CSV here"
          onOpenMappingGuide={openMappingGuide}
          onUpload={handleUpload}
          isUploading={
            uploadMutation.isPending && uploadMutation.variables?.kind === "products"
          }
        />
      </div>

      <StepCard
        stepNumber={3}
        stepTitle="Upcoming Bookings"
        status={bookingsStatus}
        stepKind="bookings"
        dropPlaceholder="Drop Bookings CSV here"
        infoBanner="Optional — import existing confirmed bookings from ERS for cutover. Only import bookings with future event dates."
        onOpenMappingGuide={openMappingGuide}
        onUpload={handleUpload}
        isUploading={
          uploadMutation.isPending && uploadMutation.variables?.kind === "bookings"
        }
      />

      {/* Author: samir */}
      {/* Impact: shared mapping guide modal — open state lives at this level */}
      {/* Reason: see openMappingGuide above; one modal instance for all cards */}
      <CsvMappingGuideModal
        open={mappingGuideStep !== null}
        onClose={closeMappingGuide}
        stepKind={mappingGuideStep ?? "customers"}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top-of-page warning banner
// ---------------------------------------------------------------------------

/**
 * Amber callout that explains why the steps below are sequential. Plain
 * presentational component — no state, no props.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */
function ImportOrderBanner() {
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 sm:px-5 sm:py-4"
    >
      <span className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true">
        <WarningIcon />
      </span>
      <p className="text-sm font-medium text-amber-800">
        <span className="font-semibold">Import order matters.</span> Import
        Customers first, then Products. Both must exist before you can import
        Bookings.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step card (reusable across all three steps)
// ---------------------------------------------------------------------------

interface StepCardProps {
  stepNumber: number;
  stepTitle: string;
  status: StepStatus;
  stepKind: StepKind;
  dropPlaceholder: string;
  /** Optional secondary callout — only Step 3 currently uses this. */
  infoBanner?: string;
  /** Called when the user clicks the View Mapping Guide button. */
  onOpenMappingGuide: (kind: StepKind) => void;
  /** Called by the dropzone when the user picks a valid .csv file. */
  onUpload: (kind: StepKind, file: File) => void | Promise<void>;
  /** True while THIS card's upload mutation is in flight. */
  isUploading: boolean;
}

/**
 * One row of the import flow. Header strip with "Step N — Title" + status
 * pill, an optional secondary info banner (Step 3 only), the .csv drop
 * zone itself, and a Download template / View Mapping Guide action row.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */
function StepCard({
  stepNumber,
  stepTitle,
  status,
  stepKind,
  dropPlaceholder,
  infoBanner,
  onOpenMappingGuide,
  onUpload,
  isUploading,
}: StepCardProps) {
  return (
    <Card className="flex flex-col gap-4 sm:gap-5">
      {/* Header row — title left, status pill right */}
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">
          Step {stepNumber} — {stepTitle}
        </h2>
        <StatusPill status={status} />
      </div>

      {/* Optional info banner — only the Bookings card uses this. Lives
          inside the card so it stays visually attached to the step it
          qualifies, not floating above it. */}
      {infoBanner && (
        <div
          role="note"
          className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3"
        >
          <span className="mt-0.5 shrink-0 text-blue-600" aria-hidden="true">
            <InfoIcon />
          </span>
          <p className="text-sm font-medium text-blue-800">{infoBanner}</p>
        </div>
      )}

      {/* Drop zone — click or drag to pick a .csv file */}
      <DropZone
        placeholder={dropPlaceholder}
        stepKind={stepKind}
        onUpload={onUpload}
        isUploading={isUploading}
      />

      {/* Action row — Download template + View Mapping Guide.
          Stack on mobile, row on sm+. */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        {/* Author: samir */}
        {/* Impact: real <a download> instead of the toast stub */}
        {/* Reason: GET /import/templates/[kind] returns the header-only CSV */}
        {/*         with Content-Disposition: attachment, so the browser fires */}
        {/*         a normal download. No JS needed. */}
        <a
          href={`/api/orgs/current/import/templates/${stepKind}`}
          download
          className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-[#1a2f6e] px-4 text-sm font-medium text-[#1a2f6e] transition-colors hover:bg-[#1a2f6e]/5 active:bg-[#1a2f6e]/10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a2f6e]/40"
        >
          Download template
        </a>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onOpenMappingGuide(stepKind)}
        >
          View Mapping Guide
        </Button>
      </div>
    </Card>
  );
}

/**
 * Maps a StepStatus into the correct Badge variant + label. Centralised
 * here so a future fifth status (e.g. "queued") only needs to be added
 * in one place.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */
function StatusPill({ status }: { status: StepStatus }) {
  switch (status) {
    case "done":
      return (
        <Badge variant="success" className="shrink-0">
          <CheckIcon /> Done
        </Badge>
      );
    case "in_progress":
      return (
        <Badge variant="info" className="shrink-0">
          Importing…
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="danger" className="shrink-0">
          Failed
        </Badge>
      );
    case "pending":
    default:
      return (
        <Badge variant="warning" className="shrink-0">
          Pending
        </Badge>
      );
  }
}

// ---------------------------------------------------------------------------
// Drop zone
// ---------------------------------------------------------------------------

interface DropZoneProps {
  placeholder: string;
  stepKind: StepKind;
  onUpload: (kind: StepKind, file: File) => void | Promise<void>;
  isUploading: boolean;
}

/**
 * Click + drag-and-drop file picker that only accepts `.csv` files.
 * Validates the file by extension OR mime type (Safari leaves the type
 * empty for files dragged from Finder) before calling the parent's
 * upload handler. Disables the click target while an upload is in flight
 * so the user can't double-fire the same file.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */
function DropZone({ placeholder, stepKind, onUpload, isUploading }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      const isCsv =
        file.type === "text/csv" ||
        file.type === "application/vnd.ms-excel" ||
        file.name.toLowerCase().endsWith(".csv");

      if (!isCsv) {
        toast.error("Please select a .csv file.");
        return;
      }

      void onUpload(stepKind, file);
    },
    [onUpload, stepKind],
  );

  const handlePick = () => {
    if (isUploading) return;
    inputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so re-selecting the same file still fires onChange.
    e.target.value = "";
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isUploading) return;
    setDragActive(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (isUploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={onFileChange}
        className="hidden"
        aria-label={`Upload ${stepKind} CSV file`}
        disabled={isUploading}
      />
      <button
        type="button"
        onClick={handlePick}
        onDragOver={onDragOver}
        onDragEnter={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        disabled={isUploading}
        aria-label={placeholder}
        aria-busy={isUploading}
        className={[
          "flex w-full flex-col items-center justify-center gap-2 rounded-xl border bg-slate-50 px-6 py-10 transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1a2f6e]/40",
          isUploading
            ? "cursor-not-allowed opacity-60"
            : dragActive
              ? "cursor-pointer border-[#1a2f6e] bg-[#1a2f6e]/5"
              : "cursor-pointer border-slate-200 hover:bg-slate-100",
        ].join(" ")}
      >
        <span className="text-slate-400" aria-hidden="true">
          <FileIcon />
        </span>
        <p className="text-sm font-medium text-slate-700">
          {isUploading ? `Importing ${stepKind}…` : placeholder}
        </p>
        <p className="text-xs text-slate-400">.csv files only</p>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline icons (kept local — these only appear on this page)
// ---------------------------------------------------------------------------

/**
 * Filled circle "i" used inside the Step 3 blue info banner.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */
function InfoIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 9V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="6.5" r="0.75" fill="currentColor" />
    </svg>
  );
}

/**
 * Triangle "!" used inside the amber order-matters banner.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */
function WarningIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10 2.5L18.5 17H1.5L10 2.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M10 8V12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="10" cy="14.5" r="0.75" fill="currentColor" />
    </svg>
  );
}

/**
 * Sheet-of-paper icon shown centred inside each drop zone. Sized at 32px
 * to match the Figma — the colour is inherited from the parent so the
 * drag-active state can darken it.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */
function FileIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M19 4H8C6.89543 4 6 4.89543 6 6V26C6 27.1046 6.89543 28 8 28H24C25.1046 28 26 27.1046 26 26V11L19 4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M19 4V11H26"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Small check inside the green "Done" status pill.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */
function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M10 3L4.5 8.5L2 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
