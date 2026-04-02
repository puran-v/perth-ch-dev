/**
 * Auth.js v5 catch-all route handler for OAuth callbacks.
 *
 * Handles /api/auth/signin, /api/auth/callback/google,
 * /api/auth/callback/microsoft-entra-id, etc.
 *
 * Does NOT conflict with our custom /api/auth/login, /api/auth/logout, etc.
 * because [...nextauth] only matches paths Auth.js registers internally.
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - OAuth
 */

// Author: Puran
// Impact: exposes Auth.js OAuth routes alongside custom auth endpoints
// Reason: Google + Microsoft OAuth requires Auth.js callback handling

import { handlers } from "@/auth";

export const { GET, POST } = handlers;
