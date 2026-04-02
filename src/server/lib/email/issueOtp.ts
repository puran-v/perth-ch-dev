import crypto from "crypto";
import { db } from "@/server/db/client";
import { sendOtpEmail } from "./sendOtpEmail";
import { logger } from "@/server/lib/logger";

// Old Author: jay
// New Author: samir
// Impact: added JSDoc with @author, @created, @module annotations
// Reason: align with PROJECT_RULES.md §4.2 function documentation requirement

/** Result type for OTP issuance — discriminated by emailSent flag */
export type IssueOtpResult =
  | { emailSent: true }
  | { emailSent: false; reason: string };

/**
 * Generates a 6-digit OTP, stores its SHA-256 hash in the database,
 * and sends the plaintext code to the user via email.
 *
 * Uses a database transaction to optionally invalidate existing OTPs
 * before creating the new one. If the email send fails, the OTP row
 * is consumed (rolled back) so the user can retry immediately.
 *
 * @param userId - The user's database ID
 * @param email - The email address to send the OTP to
 * @param options - Optional configuration
 * @param options.invalidateExisting - If true, consumes all existing unused OTPs for this user
 * @returns Object indicating whether the email was sent successfully
 *
 * @example
 * const result = await issueOtp(user.id, user.email, { invalidateExisting: true });
 * if (!result.emailSent) logger.warn("OTP email failed", { reason: result.reason });
 *
 * @author jay
 * @created 2026-04-01
 * @module Auth - Email Verification
 */
export async function issueOtp(
  userId: string,
  email: string,
  options: { invalidateExisting?: boolean } = {}
): Promise<IssueOtpResult> {
  // Business rule: OTP is 6 digits, valid for 10 minutes
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const codeHash = crypto.createHash("sha256").update(otpCode).digest("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const otpRow = await db.$transaction(async (tx) => {
    if (options.invalidateExisting) {
      // Mark all existing unused OTPs as consumed so only the new one is valid
      await tx.emailVerificationOtp.updateMany({
        where: { userId, consumedAt: null },
        data: { consumedAt: new Date() },
      });
    }

    return tx.emailVerificationOtp.create({
      data: { userId, codeHash, expiresAt },
    });
  });

  try {
    await sendOtpEmail(email, otpCode);
    return { emailSent: true };
  } catch (err) {
    logger.error("OTP email send failed", { userId }, err);

    // Roll back: consume the OTP we just created so user can retry
    await db.emailVerificationOtp
      .update({
        where: { id: otpRow.id },
        data: { consumedAt: new Date() },
      })
      .catch((rollbackErr) => {
        logger.error("OTP rollback failed", { userId }, rollbackErr);
      });

    return { emailSent: false, reason: "Failed to send verification email" };
  }
}
