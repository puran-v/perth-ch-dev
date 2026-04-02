/**
 * Centralised API client for all frontend HTTP calls.
 *
 * Wraps the native fetch API with typed request/response handling,
 * automatic auth header injection, and standardised error parsing.
 * Every client-side API call in the project MUST use this service
 * instead of raw fetch or axios (PROJECT_RULES.md §1.1).
 *
 * @example
 * // GET request
 * const { data } = await apiClient.get<Booking[]>('/api/bookings');
 *
 * // POST request
 * const { data } = await apiClient.post<Booking>('/api/bookings', { customerId: '...' });
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - API Client
 */

// Author: samir
// Impact: new centralised API service for all frontend HTTP calls
// Reason: PROJECT_RULES.md §1.1 requires shared services, §9.1 requires no raw fetch

import { getToken } from "@/lib/auth-client";

/** Standard success response from all API endpoints */
interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

/** Standard error response from all API endpoints */
interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Union type for all API responses */
type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/** Custom error class thrown when an API call fails */
export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/** Request options for the API client */
interface RequestOptions extends Omit<RequestInit, "body"> {
  /** Skip automatic auth header injection */
  skipAuth?: boolean;
}

/**
 * Builds request headers including auth token and content type.
 *
 * @param skipAuth - If true, omit the Authorization header
 * @returns Headers object ready for fetch
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - API Client
 */
function buildHeaders(skipAuth = false): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (!skipAuth) {
    const token = getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  return headers;
}

/**
 * Parses a fetch response into typed data or throws an ApiError.
 * Handles both JSON parse failures and API-level error responses.
 *
 * @param response - The raw fetch Response
 * @returns The parsed success data of type T
 * @throws {ApiError} If the response indicates an error
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - API Client
 */
async function parseResponse<T>(response: Response): Promise<T> {
  let body: ApiResponse<T>;

  try {
    body = await response.json();
  } catch {
    throw new ApiError(
      "PARSE_ERROR",
      "Failed to parse server response",
      response.status
    );
  }

  if (!body.success) {
    throw new ApiError(
      body.error.code,
      body.error.message,
      response.status,
      body.error.details
    );
  }

  return body.data;
}

/**
 * The main API client object. Use this for all frontend HTTP calls.
 *
 * Methods: get, post, patch, put, del
 * All methods automatically inject auth headers, parse responses,
 * and throw typed ApiError on failure.
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - API Client
 */
export const apiClient = {
  /**
   * Sends a GET request.
   *
   * @param url - The API endpoint path (e.g. '/api/bookings')
   * @param options - Optional fetch configuration
   * @returns The parsed response data
   *
   * @author samir
   * @created 2026-04-02
   * @module Shared - API Client
   */
  async get<T>(url: string, options: RequestOptions = {}): Promise<T> {
    const { skipAuth, ...fetchOptions } = options;
    const response = await fetch(url, {
      method: "GET",
      headers: buildHeaders(skipAuth),
      ...fetchOptions,
    });
    return parseResponse<T>(response);
  },

  /**
   * Sends a POST request with JSON body.
   *
   * @param url - The API endpoint path
   * @param body - The request payload (will be JSON-stringified)
   * @param options - Optional fetch configuration
   * @returns The parsed response data
   *
   * @author samir
   * @created 2026-04-02
   * @module Shared - API Client
   */
  async post<T>(url: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    const { skipAuth, ...fetchOptions } = options;
    const response = await fetch(url, {
      method: "POST",
      headers: buildHeaders(skipAuth),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...fetchOptions,
    });
    return parseResponse<T>(response);
  },

  /**
   * Sends a PATCH request with JSON body.
   *
   * @param url - The API endpoint path
   * @param body - The request payload (will be JSON-stringified)
   * @param options - Optional fetch configuration
   * @returns The parsed response data
   *
   * @author samir
   * @created 2026-04-02
   * @module Shared - API Client
   */
  async patch<T>(url: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    const { skipAuth, ...fetchOptions } = options;
    const response = await fetch(url, {
      method: "PATCH",
      headers: buildHeaders(skipAuth),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...fetchOptions,
    });
    return parseResponse<T>(response);
  },

  /**
   * Sends a PUT request with JSON body.
   *
   * @param url - The API endpoint path
   * @param body - The request payload (will be JSON-stringified)
   * @param options - Optional fetch configuration
   * @returns The parsed response data
   *
   * @author samir
   * @created 2026-04-02
   * @module Shared - API Client
   */
  async put<T>(url: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    const { skipAuth, ...fetchOptions } = options;
    const response = await fetch(url, {
      method: "PUT",
      headers: buildHeaders(skipAuth),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...fetchOptions,
    });
    return parseResponse<T>(response);
  },

  /**
   * Sends a DELETE request (soft-delete per PROJECT_RULES.md §5.3).
   *
   * @param url - The API endpoint path
   * @param options - Optional fetch configuration
   * @returns The parsed response data
   *
   * @author samir
   * @created 2026-04-02
   * @module Shared - API Client
   */
  async del<T>(url: string, options: RequestOptions = {}): Promise<T> {
    const { skipAuth, ...fetchOptions } = options;
    const response = await fetch(url, {
      method: "DELETE",
      headers: buildHeaders(skipAuth),
      ...fetchOptions,
    });
    return parseResponse<T>(response);
  },
};
