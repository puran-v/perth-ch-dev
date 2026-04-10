"use client";

/**
 * React Query mutation for the multipart CSV upload endpoint.
 *
 * Bypasses the shared `apiClient.post` because that helper forces
 * `Content-Type: application/json` and JSON-stringifies the body.
 * Multipart uploads need the browser to set its own boundary header,
 * so we use raw `fetch` here and reuse `apiClient`'s response shape
 * via the standard ApiError type.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import Hooks
 */

// Author: samir
// Impact: powers the dropzone "Selected …" toast on the CSV Import page
// Reason: real upload + per-row error report instead of the mock toast

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";
import { IMPORT_STATUS_QUERY_KEY } from "@/hooks/csv-import/useImportStatus";
import type {
  ImportRunRejected,
  ImportRunResult,
  StepKind,
} from "@/types/csv-import";

/** Mutation input — the file to upload + which kind it belongs to. */
export interface UploadCsvInput {
  kind: StepKind;
  file: File;
}

/**
 * Discriminated union the FE branches on after a successful HTTP call.
 *
 * - `ok: true`  → at least one row was attempted (status COMPLETED or
 *                 row-level FAILED). The result includes per-row errors.
 * - `ok: false` → pre-validation rejection (wrong headers, oversized).
 *                 No row was attempted. The result has the failure code.
 */
export type UploadCsvOutcome =
  | { ok: true; result: ImportRunResult }
  | { ok: false; result: ImportRunRejected };

/**
 * React Query mutation hook. On success, invalidates the status query
 * so the step pills + last-imported timestamps refresh immediately.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import Hooks
 */
export function useUploadCsv(): UseMutationResult<
  UploadCsvOutcome,
  ApiError,
  UploadCsvInput
> {
  const queryClient = useQueryClient();

  return useMutation<UploadCsvOutcome, ApiError, UploadCsvInput>({
    mutationFn: async ({ kind, file }) => {
      const formData = new FormData();
      formData.append("file", file);

      // NOTE: do NOT set Content-Type manually — the browser must add the
      // boundary parameter (e.g. "multipart/form-data; boundary=..."), which
      // it only does when Content-Type is left unset.
      const response = await fetch(`/api/orgs/current/import/${kind}`, {
        method: "POST",
        body: formData,
      });

      const json = (await response.json().catch(() => null)) as
        | { success: true; data: ImportRunResult }
        | { success: true; data: ImportRunRejected }
        | {
            success: false;
            error: { code: string; message: string; details?: unknown };
          }
        | null;

      if (!json) {
        throw new ApiError(
          "INVALID_RESPONSE",
          "Server returned an empty or non-JSON response.",
          response.status,
        );
      }

      if (json.success === false) {
        throw new ApiError(
          json.error.code,
          json.error.message,
          response.status,
          json.error.details,
        );
      }

      // 422 with success:true is the pre-validation rejection branch.
      // The route returns a 422 status with `{ success: true, data: { failureCode } }`
      // so the FE can render a specific error card without throwing.
      if (response.status === 422) {
        return { ok: false, result: json.data as ImportRunRejected };
      }

      return { ok: true, result: json.data as ImportRunResult };
    },
    onSuccess: () => {
      // Refresh the status pills no matter the outcome — failed runs still
      // create an ImportJob row that we want reflected in the UI.
      queryClient.invalidateQueries({ queryKey: IMPORT_STATUS_QUERY_KEY });
    },
  });
}
