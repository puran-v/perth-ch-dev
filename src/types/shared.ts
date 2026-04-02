/**
 * Shared type definitions used across all modules.
 *
 * @module Shared
 */

/** Standard success response format for all API endpoints */
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

/** Standard error response format for all API endpoints */
export interface ApiError {
  success: false;
  error: {
    /** Machine-readable error code, e.g. 'BOOKING_CONFLICT' */
    code: string;
    /** Human-readable error message */
    message: string;
    /** Optional additional context */
    details?: unknown;
  };
}

/** Standard paginated response format */
export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** AI recommendation response format */
export interface AIRecommendation {
  type: 'suggestion' | 'warning' | 'risk_flag' | 'draft';
  title: string;
  explanation: string;
  suggestedAction?: string;
  confidence: number;
  data?: unknown;
}
