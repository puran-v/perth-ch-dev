/**
 * Consistent JSON response shape for all API routes.
 *
 * Keeping one shape across every endpoint means clients never need to guess
 * which field holds the data or how errors are structured.
 *
 * Success: { success: true,  data: T }
 * Error:   { success: false, error: { code: string, message: string, details?: unknown } }
 *
 * @author samir
 * @created 2026-04-01
 * @module Shared - API Response
 */

// Old Author: jay
// New Author: samir
// Impact: error code is now required, added details field, added JSDoc
// Reason: align with PROJECT_RULES.md §4.5 standard error response format

type SuccessPayload<T> = {
  success: true;
  data: T;
};

type ErrorPayload = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

/**
 * Creates a standardised success response.
 *
 * @param data - The response payload
 * @param status - HTTP status code (defaults to 200)
 * @returns JSON response with { success: true, data }
 *
 * @author samir
 * @created 2026-04-01
 * @module Shared - API Response
 */
export function success<T>(data: T, status = 200): Response {
  const body: SuccessPayload<T> = { success: true, data };
  return Response.json(body, { status });
}

/**
 * Creates a standardised error response.
 *
 * @param code - Machine-readable error code (e.g. 'BOOKING_CONFLICT')
 * @param message - Human-readable error message
 * @param status - HTTP status code (defaults to 500)
 * @param details - Optional additional context for the error
 * @returns JSON response with { success: false, error: { code, message, details? } }
 *
 * @author samir
 * @created 2026-04-01
 * @module Shared - API Response
 */
export function error(
  code: string,
  message: string,
  status = 500,
  details?: unknown
): Response {
  const body: ErrorPayload = {
    success: false,
    error: { code, message, ...(details !== undefined ? { details } : {}) },
  };
  return Response.json(body, { status });
}
