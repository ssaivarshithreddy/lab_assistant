import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Creates nodemailer transporter if SMTP credentials exist in process.env.
 */
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });
  }

  if (process.env.SMTP_SERVICE && user && pass) {
    return nodemailer.createTransport({
      service: process.env.SMTP_SERVICE,
      auth: { user, pass },
    });
  }

  return null;
}

/**
 * Sends a 6-digit OTP email to recipient.
 * Falls back to console log if SMTP is not configured.
 */
export async function sendOtpEmail(toEmail, otpCode, context = 'Verification') {
  const transporter = createTransporter();
  const from = process.env.SMTP_FROM || '"LabSense Medical AI" <no-reply@labsense.com>';

  const subject = `Your ${context} Verification Code: ${otpCode}`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #2563eb; margin-top: 0;">LabSense Medical AI Assistant</h2>
      <p style="font-size: 16px; color: #333;">Hello,</p>
      <p style="font-size: 16px; color: #333;">Your <strong>${context}</strong> 6-digit OTP security code is:</p>
      <div style="background-color: #f1f5f9; padding: 15px; text-align: center; border-radius: 6px; margin: 20px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1e293b;">${otpCode}</span>
      </div>
      <p style="font-size: 14px; color: #64748b;">This code will expire in 15 minutes. If you did not request this code, please ignore this email.</p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="font-size: 12px; color: #94a3b8;">LabSense Health & Lab Analysis Portal — Secure & Encrypted</p>
    </div>
  `;

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from,
        to: toEmail,
        subject,
        html: htmlContent,
      });
      console.log(`[EMAIL DISPATCH] Real OTP email sent successfully to ${toEmail} (MessageId: ${info.messageId})`);
      return { success: true, delivered: true, messageId: info.messageId };
    } catch (err) {
      console.error(`[EMAIL ERROR] Failed to send email via SMTP to ${toEmail}:`, err.message);
      console.log(`[TERMINAL FALLBACK OTP] Code for ${toEmail}: ${otpCode}`);
      return { success: false, delivered: false, error: err.message, otpCode };
    }
  } else {
    console.log(`\n========================================================`);
    console.log(`[DEV MODE - SMTP NOT CONFIGURED]`);
    console.log(`Target Recipient: ${toEmail}`);
    console.log(`Verification Context: ${context}`);
    console.log(`Generated OTP Code: ${otpCode}`);
    console.log(`Notice: Configure SMTP_HOST, SMTP_USER, & SMTP_PASS in .env to send real emails to inbox.`);
    console.log(`========================================================\n`);
    return { success: true, delivered: false, devMode: true, otpCode };
  }
}
