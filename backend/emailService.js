import nodemailer from 'nodemailer';
import './env.js';

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
      connectionTimeout: 4000,
      greetingTimeout: 4000,
      socketTimeout: 5000,
      auth: {
        user,
        pass,
      },
    });
  }

  if (process.env.SMTP_SERVICE && user && pass) {
    return nodemailer.createTransport({
      service: process.env.SMTP_SERVICE,
      connectionTimeout: 4000,
      greetingTimeout: 4000,
      socketTimeout: 5000,
      auth: { user, pass },
    });
  }

  return null;
}

/**
 * HTTPS-based email delivery via Resend API (Bypasses ISP port blocks)
 */
async function sendViaResend(toEmail, subject, htmlContent) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  try {
    const from = process.env.SMTP_FROM || 'LabSense AI <onboarding@resend.dev>';
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [toEmail],
        subject,
        html: htmlContent,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      console.log(`[EMAIL DISPATCH] Real OTP email sent via Resend HTTPS to ${toEmail} (Id: ${data.id})`);
      return { success: true, delivered: true, messageId: data.id };
    }
    console.warn(`[RESEND API WARN] Resend responded with status ${res.status}:`, data);
  } catch (err) {
    console.warn(`[RESEND API ERROR]:`, err.message);
  }
  return null;
}

/**
 * Sends a 6-digit OTP email to recipient.
 * Production mode strictly delivers email; Development mode allows terminal fallback.
 */
export async function sendOtpEmail(toEmail, otpCode, context = 'Verification') {
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

  // 1. Try Resend HTTP API first if configured (never blocked by ISP)
  if (process.env.RESEND_API_KEY) {
    const resendResult = await sendViaResend(toEmail, subject, htmlContent);
    if (resendResult?.success) return resendResult;
  }

  // 2. Try SMTP Transporter
  const transporter = createTransporter();
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
      if (process.env.NODE_ENV === 'production') {
        console.error(`[EMAIL ERROR] Failed to deliver OTP to ${toEmail} in production: ${err.message}`);
        return { success: false, delivered: false, error: err.message };
      }
      console.error(`\n[DEV NOTICE] Outbound SMTP port is blocked by local network/ISP (${err.code || err.message}).`);
      console.log(`===================================================================`);
      console.log(`[LOCAL DEV OTP CODE] Recipient: ${toEmail}`);
      console.log(`Verification Code: ${otpCode}`);
      console.log(`Context: ${context}`);
      console.log(`(This fallback OTP is strictly enabled in development mode)`);
      console.log(`===================================================================\n`);
      return { success: false, delivered: false, error: err.message, otpCode };
    }
  } else {
    if (process.env.NODE_ENV === 'production') {
      console.error(`[CRITICAL] Email transport is not configured in production environment.`);
      return { success: false, delivered: false, error: 'Email transport unconfigured' };
    }
    console.log(`\n===================================================================`);
    console.log(`[LOCAL DEV MODE - SMTP NOT CONFIGURED]`);
    console.log(`Verification Code: ${otpCode}`);
    console.log(`Recipient: ${toEmail} (${context})`);
    console.log(`===================================================================\n`);
    return { success: true, delivered: false, devMode: true, otpCode };
  }
}
