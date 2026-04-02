/**
 * App-wide constants and enums.
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared
 */

/** Booking ID prefix used across all modules */
export const BOOKING_ID_PREFIX = 'BK-';

/** Invoice number prefix (configurable per org) */
export const DEFAULT_INVOICE_PREFIX = 'INV-';

/** Feature flags — controls which modules are active */
export const FEATURES = {
  MODULE_A_QUOTING: true,
  MODULE_A_EMAIL_AUTOMATION: false,
  MODULE_B_INVENTORY: true,
  MODULE_C_WAREHOUSE: false,
  MODULE_C_VOICE_AI: false,
  MODULE_D_FINANCE: true,
  MODULE_D_STRIPE: true,
  MODULE_D_SQUARE: false,
  MODULE_D_PAYPAL: false,
  CSV_IMPORT: false,
} as const;
