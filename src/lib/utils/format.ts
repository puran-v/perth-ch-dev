/**
 * Shared formatting utilities for dates, currency, and IDs.
 *
 * All modules use these instead of ad-hoc formatting. Perth timezone
 * (Australia/Perth, UTC+8) is the default for all date formatting
 * since the business operates in Western Australia.
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Utilities
 */

// Author: samir
// Impact: new shared format utilities used across all modules
// Reason: PROJECT_RULES.md §1.1 requires shared utilities, §2.2 defines booking ID format

const PERTH_TIMEZONE = "Australia/Perth";
const CURRENCY = "AUD";
const LOCALE = "en-AU";

/**
 * Formats a date for display in the Perth timezone.
 *
 * @param date - The date to format (string, Date, or timestamp)
 * @param style - Formatting style: 'short' (02/04/2026), 'medium' (2 Apr 2026),
 *                'long' (2 April 2026), 'full' (Wednesday, 2 April 2026)
 * @returns Formatted date string
 *
 * @example
 * formatDate('2026-04-02T10:00:00Z', 'medium') // '2 Apr 2026'
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Utilities
 */
export function formatDate(
  date: string | Date | number,
  style: "short" | "medium" | "long" | "full" = "medium"
): string {
  const d = new Date(date);
  return d.toLocaleDateString(LOCALE, {
    dateStyle: style,
    timeZone: PERTH_TIMEZONE,
  });
}

/**
 * Formats a date with time for display in the Perth timezone.
 *
 * @param date - The date to format
 * @param showSeconds - Whether to include seconds (default: false)
 * @returns Formatted date-time string (e.g. '2 Apr 2026, 6:00 pm')
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Utilities
 */
export function formatDateTime(
  date: string | Date | number,
  showSeconds = false
): string {
  const d = new Date(date);
  return d.toLocaleString(LOCALE, {
    dateStyle: "medium",
    timeStyle: showSeconds ? "medium" : "short",
    timeZone: PERTH_TIMEZONE,
  });
}

/**
 * Formats a time for display in the Perth timezone.
 *
 * @param date - The date/time to format
 * @returns Formatted time string (e.g. '6:00 pm')
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Utilities
 */
export function formatTime(date: string | Date | number): string {
  const d = new Date(date);
  return d.toLocaleTimeString(LOCALE, {
    timeStyle: "short",
    timeZone: PERTH_TIMEZONE,
  });
}

/**
 * Formats a number as AUD currency.
 *
 * @param amount - The amount in dollars
 * @param showCents - Whether to always show cents (default: true)
 * @returns Formatted currency string (e.g. '$1,200.00')
 *
 * @example
 * formatCurrency(1200) // '$1,200.00'
 * formatCurrency(1200, false) // '$1,200'
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Utilities
 */
export function formatCurrency(amount: number, showCents = true): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Generates a booking ID in the format BK-XXXXX.
 * Uses a 5-digit zero-padded sequential number.
 *
 * @param sequenceNumber - The sequential number for the booking
 * @returns Formatted booking ID (e.g. 'BK-00042')
 *
 * @example
 * generateBookingId(42) // 'BK-00042'
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Utilities
 */
export function generateBookingId(sequenceNumber: number): string {
  return `BK-${String(sequenceNumber).padStart(5, "0")}`;
}

/**
 * Generates an invoice number in the format INV-XXXXX.
 * Supports a configurable prefix per org (PROJECT_RULES.md §5.5).
 *
 * @param sequenceNumber - The sequential number for the invoice
 * @param prefix - The invoice prefix (default: 'INV-')
 * @returns Formatted invoice number (e.g. 'INV-00001')
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Utilities
 */
export function generateInvoiceNumber(
  sequenceNumber: number,
  prefix = "INV-"
): string {
  return `${prefix}${String(sequenceNumber).padStart(5, "0")}`;
}

/**
 * Truncates a string to the specified length with ellipsis.
 *
 * @param str - The string to truncate
 * @param maxLength - Maximum length before truncation (default: 50)
 * @returns Truncated string with '...' if it exceeds maxLength
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Utilities
 */
export function truncate(str: string, maxLength = 50): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength)}...`;
}

/**
 * Formats a relative time string (e.g. '2 hours ago', 'in 3 days').
 *
 * @param date - The date to compare against now
 * @returns Human-readable relative time string
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Utilities
 */
export function formatRelativeTime(date: string | Date | number): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffSeconds = Math.round((then - now) / 1000);

  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });

  const thresholds: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [3600, "minute"],
    [86400, "hour"],
    [2592000, "day"],
    [31536000, "month"],
    [Infinity, "year"],
  ];

  for (const [threshold, unit] of thresholds) {
    if (Math.abs(diffSeconds) < threshold) {
      const divisors: Record<string, number> = {
        second: 1,
        minute: 60,
        hour: 3600,
        day: 86400,
        month: 2592000,
        year: 31536000,
      };
      const value = Math.round(diffSeconds / divisors[unit]);
      return rtf.format(value, unit);
    }
  }

  return rtf.format(0, "second");
}
