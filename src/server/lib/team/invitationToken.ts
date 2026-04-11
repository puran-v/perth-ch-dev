/**
 * Invitation token helpers — generate raw token + SHA-256 hash for storage.
 *
 * Raw token is returned only once (in the email link); the DB stores the hash.
 * Same pattern as password reset tokens — reversible lookup requires the raw token.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Invitations
 */

// Author: Puran
// Impact: shared token generator for invitation create and resend flows
// Reason: avoid duplication; consistent token security pattern across auth features

import crypto from "crypto";

/** Default invitation lifetime — 7 days */
export const DEFAULT_INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * "Remove expiry" sentinel — far-future date.
 *
 * We use a sentinel instead of nullable expiresAt because:
 * - Prisma indexed range queries (`expiresAt > now()`) stay simple and fast
 * - No special null-handling branches in every invitation query
 * - Easy to revert: PATCH back to a real date if product changes mind
 */
export const NO_EXPIRY_SENTINEL = new Date("2099-12-31T23:59:59.000Z");

/**
 * Generates a raw invitation token (UUID) and its SHA-256 hash.
 * Store the hash in the DB; include the raw token in the invite email link.
 *
 * @returns { rawToken, tokenHash, expiresAt } — 7 days default
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Invitations
 */
export function generateInvitationToken(): {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
} {
  const rawToken = crypto.randomUUID();
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + DEFAULT_INVITE_EXPIRY_MS);
  return { rawToken, tokenHash, expiresAt };
}

/**
 * Hashes a raw invitation token for DB lookup on accept.
 * Same algorithm as generateInvitationToken() so the hash lines up.
 *
 * @param rawToken - The UUID from the accept URL
 * @returns SHA-256 hash (hex) matching Invitation.tokenHash
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Invitations
 */
export function hashInvitationToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Builds the absolute accept-invitation URL embedded in the email.
 * Throws if FRONTEND_URL is not configured — callers should handle it
 * the same way forgot-password does (log + skip the send).
 *
 * @param rawToken - The raw UUID token (never the hash)
 * @returns Full https URL to the /accept-invitation page
 * @throws Error if no base URL is configured
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Invitations
 */
export function buildInvitationAcceptUrl(rawToken: string): string {
  const baseUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) {
    throw new Error("FRONTEND_URL not configured — cannot build invitation link");
  }
  return `${baseUrl}/accept-invitation?token=${encodeURIComponent(rawToken)}`;
}
