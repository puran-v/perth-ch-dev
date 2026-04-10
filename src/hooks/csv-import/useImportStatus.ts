"use client";

/**
 * React Query hook for the CSV Import status endpoint. One round-trip
 * returns the most-recent ImportJob per kind, which the FE maps to a
 * StepStatus pill on each step card.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import Hooks
 */

// Author: samir
// Impact: replaces the page's hardcoded mock literals
// Reason: GET /api/orgs/current/import/status drives the 3 step pills

import { useApiQuery } from "@/hooks/useApiQuery";
import type {
  ImportJobDto,
  ImportStatusResponse,
  StepKind,
  StepStatus,
} from "@/types/csv-import";

/** Cache key for the status query — exported so mutations can invalidate it. */
export const IMPORT_STATUS_QUERY_KEY = ["csv-import-status"] as const;

/**
 * Fetches the most-recent ImportJob per kind for the caller's org.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import Hooks
 */
export function useImportStatus() {
  return useApiQuery<ImportStatusResponse>(
    IMPORT_STATUS_QUERY_KEY,
    "/api/orgs/current/import/status",
    {
      // Status changes only when the user runs an import. Refetching on
      // every focus is wasteful — invalidation after the upload mutation
      // is enough.
      staleTime: 30 * 1000,
      refetchOnWindowFocus: false,
    },
  );
}

/**
 * Maps an ImportJob (or null) to the StepStatus the page card pill
 * needs. Lives next to the hook so consumers don't have to repeat the
 * same switch in three places.
 *
 * - null  → "pending" (no import has been run yet)
 * - RUNNING → "in_progress" (only used once async lands; sync flips
 *   straight from pending to completed/failed in one request)
 * - COMPLETED + at least one row imported → "done"
 * - COMPLETED but zero rows → "pending" (treat header-only or
 *   all-skipped runs as "still nothing imported")
 * - FAILED → "failed"
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import Hooks
 */
export function deriveStepStatus(job: ImportJobDto | null): StepStatus {
  if (!job) return "pending";
  if (job.status === "RUNNING") return "in_progress";
  if (job.status === "FAILED") return "failed";
  // COMPLETED — but only count it as "done" if at least one row landed
  if (job.importedRows > 0) return "done";
  return "pending";
}

/** Convenience: pulls the right job out of the status response by kind. */
export function getJobForKind(
  status: ImportStatusResponse | undefined,
  kind: StepKind,
): ImportJobDto | null {
  if (!status) return null;
  switch (kind) {
    case "customers":
      return status.customers;
    case "products":
      return status.products;
    case "bookings":
      return status.bookings;
  }
}
