import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendPasswordResetEmail(toEmail: string, resetUrl: string) {
  const subject = "Reset your password";
  const text = `You requested a password reset. Use this link to set a new password: ${resetUrl}\n\nThis link expires in 30 minutes. If you didn't request this, ignore this email.`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;">
      <h2>Password Reset</h2>
      <p>You requested a password reset. Click the link below to set a new password:</p>
      <p><a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#1a2f6e;color:#fff;text-decoration:none;border-radius:5px;">Reset Password</a></p>
      <p style="color:#666;font-size:14px;">This link expires in 30 minutes. If you didn't request this, ignore this email.</p>
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
