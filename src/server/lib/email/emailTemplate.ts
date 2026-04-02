// Author: Puran
// Impact: shared branded email template used by all transactional emails
// Reason: consistent professional look across OTP, password reset, and future emails

/**
 * Returns the base URL for public assets in emails.
 * Email clients need absolute URLs — relative paths won't work.
 *
 * @returns Absolute base URL string
 *
 * @author Puran
 * @created 2026-04-02
 * @module Shared - Email
 */
function getBaseUrl(): string {
  return process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

const BRAND_COLOR = "#1a2f6e";
const BRAND_COLOR_LIGHT = "#e8ebf4";
const TEXT_PRIMARY = "#1a1a2e";
const TEXT_SECONDARY = "#64748b";
const BORDER_COLOR = "#e2e8f0";

/**
 * Wraps email body content in a branded layout with logo header,
 * content area, and footer. Fully inline-styled for email client compatibility.
 *
 * @param body - The inner HTML content of the email
 * @returns Complete HTML email string ready for transporter.sendMail()
 *
 * @author Puran
 * @created 2026-04-02
 * @module Shared - Email
 */
export function wrapEmailTemplate(body: string): string {
  const baseUrl = getBaseUrl();
  const logoUrl = `${baseUrl}/assets/logo.png`;
  const year = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>The Fun Depot</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <!-- Card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- Header with logo -->
          <tr>
            <td style="background-color:${BRAND_COLOR};padding:32px 40px;text-align:center;">
              <img src="${logoUrl}" alt="The Fun Depot" width="180" style="display:block;margin:0 auto;max-width:180px;height:auto;" />
            </td>
          </tr>

          <!-- Body content -->
          <tr>
            <td style="padding:36px 40px 28px;">
              ${body}
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none;border-top:1px solid ${BORDER_COLOR};margin:0;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 32px;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;color:${TEXT_SECONDARY};line-height:1.5;">
                This is an automated message from The Fun Depot.
                <br />Please do not reply to this email.
              </p>
              <p style="margin:0;font-size:12px;color:${TEXT_SECONDARY};line-height:1.5;">
                &copy; ${year} The Fun Depot &mdash; Perth, Western Australia
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generates a styled primary action button for emails.
 *
 * @param text - Button label
 * @param href - Button URL
 * @returns HTML string for a centered CTA button
 *
 * @author Puran
 * @created 2026-04-02
 * @module Shared - Email
 */
export function emailButton(text: string, href: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td align="center">
          <a href="${href}" target="_blank" style="display:inline-block;padding:14px 36px;background-color:${BRAND_COLOR};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;letter-spacing:0.3px;">
            ${text}
          </a>
        </td>
      </tr>
    </table>`;
}

/**
 * Generates a large styled OTP code display for verification emails.
 *
 * @param code - The OTP code to display
 * @returns HTML string for a centered OTP code block
 *
 * @author Puran
 * @created 2026-04-02
 * @module Shared - Email
 */
export function emailOtpBlock(code: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td align="center">
          <div style="display:inline-block;padding:16px 40px;background-color:${BRAND_COLOR_LIGHT};border-radius:10px;border:1px solid ${BORDER_COLOR};">
            <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:${BRAND_COLOR};font-family:'Courier New',monospace;">${code}</span>
          </div>
        </td>
      </tr>
    </table>`;
}

export { BRAND_COLOR, TEXT_PRIMARY, TEXT_SECONDARY };
