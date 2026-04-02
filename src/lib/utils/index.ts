/**
 * Barrel export for all shared utility functions.
 *
 * Import from '@/lib/utils' instead of individual files.
 *
 * @example
 * import { cn, formatDate, formatCurrency } from '@/lib/utils';
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Utilities
 */

export { cn } from "./cn";
export {
  formatDate,
  formatDateTime,
  formatTime,
  formatCurrency,
  formatRelativeTime,
  generateBookingId,
  generateInvoiceNumber,
  truncate,
} from "./format";
