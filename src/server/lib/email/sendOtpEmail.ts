import nodemailer from "nodemailer";

// Old Author: jay
// New Author: samir
// Impact: added JSDoc annotations to transporter and function
// Reason: align with PROJECT_RULES.md §4.2 function documentation requirement

/**
 * Nodemailer transporter configured from SMTP environment variables.
 * Uses TLS on port 587 by default (STARTTLS upgrade).
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
 * Sends a verification OTP email to the specified address.
 * Includes both plaintext and HTML versions for maximum email
 * client compatibility.
 *
 * @param toEmail - The recipient email address
 * @param otpCode - The 6-digit OTP code to include in the email
 * @throws If the email fails to send (caller should handle)
 *
 * @author jay
 * @created 2026-04-01
 * @module Auth - Email Verification
 */
export async function sendOtpEmail(toEmail: string, otpCode: string): Promise<void> {
  const subject = "Verify your email";
  const text = `Your verification code is: ${otpCode}. It expires in 10 minutes.`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;">
      <h2>Email Verification</h2>
      <p>Your OTP code is:</p>
      <p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${otpCode}</p>
      <p>This code expires in 10 minutes.</p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: toEmail,
    subject,
    text,
    html,
  });
}
