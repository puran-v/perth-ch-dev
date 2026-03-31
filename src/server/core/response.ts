/**
 * Consistent JSON response shape for all API routes.
 *
 * Keeping one shape across every endpoint means clients never need to guess
 * which field holds the data or how errors are structured.
 *
 * Success: { success: true,  data: T }
 * Error:   { success: false, error: { message: string, code?: string } }
 */

type SuccessPayload<T> = {
  success: true;
  data: T;
};

type ErrorPayload = {
  success: false;
  error: {
    message: string;
    code?: string;
  };
};

export function success<T>(data: T, status = 200): Response {
  const body: SuccessPayload<T> = { success: true, data };
  return Response.json(body, { status });
}

export function error(
  message: string,
  status = 500,
  // Machine-readable identifier (e.g. "DB_UNREACHABLE") for clients that need
  // to branch on error type. Omit it and the key is absent from the response entirely.
  code?: string
): Response {
  // Conditional spread omits the `code` key entirely when undefined,
  // rather than serialising it as null.
  const body: ErrorPayload = {
    success: false,
    error: { message, ...(code ? { code } : {}) },
  };
  return Response.json(body, { status });
}
