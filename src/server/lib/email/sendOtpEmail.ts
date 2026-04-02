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

export async function sendOtpEmail(toEmail: string, otpCode: string) {
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
