import nodemailer from "nodemailer";
import { wrapEmailTemplate, emailOtpBlock, TEXT_PRIMARY, TEXT_SECONDARY } from "./emailTemplate";

// Old Author: jay
// New Author: Puran
// Impact: replaced inline HTML with branded email template
// Reason: consistent professional look across all transactional emails

/**
 * Nodemailer transporter configured from SMTP environment variables.
 * Uses TLS on port 587 by default (STARTTLS upgrade).
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - Email Verification
 */
// Author: Puran
// Impact: secure flag now derived from port — port 465 uses implicit TLS
// Reason: fix "Greeting never received" error when SMTP_PORT=465
const smtpPort = Number(process.env.SMTP_PORT || 587);
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Sends a verification OTP email with branded template.
 * Includes both plaintext and HTML versions for maximum email
 * client compatibility.
 *
 * @param toEmail - The recipient email address
 * @param otpCode - The 6-digit OTP code to include in the email
 * @throws If the email fails to send (caller should handle)
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - Email Verification
 */
export async function sendOtpEmail(toEmail: string, otpCode: string): Promise<void> {
  const subject = "Verify your email — The Fun Depot";
  const text = `Your verification code is: ${otpCode}. It expires in 10 minutes.`;

  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${TEXT_PRIMARY};">
      Verify your email
    </h2>
    <p style="margin:0 0 4px;font-size:15px;color:${TEXT_SECONDARY};line-height:1.6;">
      Use the code below to verify your email address.
    </p>

    ${emailOtpBlock(otpCode)}

    <p style="margin:0 0 4px;font-size:14px;color:${TEXT_SECONDARY};line-height:1.6;">
      This code expires in <strong style="color:${TEXT_PRIMARY};">10 minutes</strong>.
    </p>
    <p style="margin:0;font-size:13px;color:${TEXT_SECONDARY};line-height:1.6;">
      If you didn&rsquo;t create an account, you can safely ignore this email.
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
