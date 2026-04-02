import nodemailer from "nodemailer";
import { wrapEmailTemplate, emailButton, TEXT_PRIMARY, TEXT_SECONDARY } from "./emailTemplate";

// Old Author: Puran
// New Author: Puran
// Impact: replaced inline HTML with branded email template
// Reason: consistent professional look across all transactional emails

/**
 * Nodemailer transporter configured from SMTP environment variables.
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - Password Reset
 */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Sends a password reset email with a branded template and CTA button.
 * Includes both plaintext and HTML versions for compatibility.
 *
 * @param toEmail - The recipient email address
 * @param resetUrl - The full password reset URL with token
 * @throws If the email fails to send (caller should handle)
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - Password Reset
 */
export async function sendPasswordResetEmail(toEmail: string, resetUrl: string): Promise<void> {
  const subject = "Reset your password — The Fun Depot";
  const text = `You requested a password reset. Use this link to set a new password: ${resetUrl}\n\nThis link expires in 30 minutes. If you didn't request this, ignore this email.`;

  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${TEXT_PRIMARY};">
      Reset your password
    </h2>
    <p style="margin:0 0 4px;font-size:15px;color:${TEXT_SECONDARY};line-height:1.6;">
      We received a request to reset your password. Click the button below to choose a new one.
    </p>

    ${emailButton("Reset Password", resetUrl)}

    <p style="margin:0 0 4px;font-size:14px;color:${TEXT_SECONDARY};line-height:1.6;">
      This link expires in <strong style="color:${TEXT_PRIMARY};">30 minutes</strong>.
    </p>
    <p style="margin:0 0 16px;font-size:13px;color:${TEXT_SECONDARY};line-height:1.6;">
      If you didn&rsquo;t request a password reset, you can safely ignore this email. Your password will remain unchanged.
    </p>

    <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;word-break:break-all;">
      If the button doesn&rsquo;t work, copy and paste this link:<br />
      <a href="${resetUrl}" style="color:#1a2f6e;text-decoration:underline;">${resetUrl}</a>
    </p>
  `;

  const html = wrapEmailTemplate(body);

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: toEmail,
    subject,
    text,
    html,
  });
}
