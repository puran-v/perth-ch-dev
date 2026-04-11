/**
 * Pagination helpers for list endpoints per PROJECT_RULES §6.2.
 *
 * All list endpoints MUST support pagination with { page, limit, total, totalPages }.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Shared - Pagination
 */

// Author: Puran
// Impact: shared pagination parser + meta builder for all list endpoints
// Reason: §6.2 requires consistent pagination across the entire API

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Parses pagination params from a URL's searchParams.
 * Clamps values to safe bounds (page >= 1, 1 <= limit <= 100).
 *
 * @param searchParams - URLSearchParams from the request URL
 * @returns Normalised { page, limit, skip } for Prisma queries
 *
 * @example
 * const { page, limit, skip } = parsePagination(new URL(req.url).searchParams);
 * const rows = await db.role.findMany({ skip, take: limit });
 *
 * @author Puran
 * @created 2026-04-06
 * @module Shared - Pagination
 */
export function parsePagination(searchParams: URLSearchParams): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = Math.max(DEFAULT_PAGE, Number(searchParams.get("page")) || DEFAULT_PAGE);
  const limitRaw = Number(searchParams.get("limit")) || DEFAULT_LIMIT;
  const limit = Math.min(MAX_LIMIT, Math.max(1, limitRaw));
  return { page, limit, skip: (page - 1) * limit };
}

/**
 * Builds the pagination metadata object for the response.
 *
 * @param page - Current page number
 * @param limit - Items per page
 * @param total - Total item count (from Prisma .count())
 * @returns Pagination meta with totalPages computed
 *
 * @author Puran
 * @created 2026-04-06
 * @module Shared - Pagination
 */
export function paginationMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
