import crypto from "crypto";
import { db } from "@/server/db/client";
import { sendOtpEmail } from "./sendOtpEmail";
import { logger } from "@/server/lib/logger";

export type IssueOtpResult =
  | { emailSent: true }
  | { emailSent: false; reason: string };

/**
 * Generate OTP, store in DB, and send email.
 *
 * - Wraps invalidate (optional) + create in a transaction.
 * - If email send fails, rolls back the new OTP row so the user can retry.
 */
export async function issueOtp(
  userId: string,
  email: string,
  options: { invalidateExisting?: boolean } = {}
): Promise<IssueOtpResult> {
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const codeHash = crypto.createHash("sha256").update(otpCode).digest("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const otpRow = await db.$transaction(async (tx) => {
    if (options.invalidateExisting) {
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
  } catch (error) {
    logger.error("OTP email send failed", { userId }, error);

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
