import nodemailer from "nodemailer";
import { randomInt } from "node:crypto";
import { SMTP_PASS, SMTP_USER } from "../../../config/config.env.js";

// Helper to resolve and sanitize SMTP credentials from multiple standard env var names
export const getSmtpCredentials = () => {
  const user = (
    process.env.SMTP_USER ||
    process.env.GMAIL_USER ||
    process.env.EMAIL_USER ||
    process.env.MAIL_USER ||
    SMTP_USER ||
    ""
  ).trim();

  const rawPass =
    process.env.SMTP_PASS ||
    process.env.GMAIL_APP_PASSWORD ||
    process.env.EMAIL_PASS ||
    process.env.GMAIL_PASS ||
    process.env.MAIL_PASS ||
    SMTP_PASS ||
    "";

  // Google App Passwords often contain spaces (e.g. 'xxxx xxxx xxxx xxxx'); remove all spaces
  const pass = rawPass.replace(/\s+/g, "");

  return { user, pass };
};

// Create a serverless-safe transporter instance
// Note: In serverless environments (e.g. Vercel), pool: false is CRITICAL
// so stale sockets are not reused across frozen execution contexts.
export const createTransporter = () => {
  const { user, pass } = getSmtpCredentials();

  if (!user || !pass) {
    const errorMsg =
      "SMTP credentials missing! Both SMTP_USER (or GMAIL_USER) and SMTP_PASS (or GMAIL_APP_PASSWORD) " +
      "must be configured in your environment variables. In Vercel, add them in Project Settings > Environment Variables.";
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT) || 465;
  const secure =
    process.env.SMTP_SECURE !== undefined
      ? process.env.SMTP_SECURE === "true"
      : port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure, // true for port 465 SSL, false for 587 STARTTLS
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
    pool: false, // Critical for serverless runtimes
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
};

// Returns transporter for sending
export const getTransporter = () => {
  return createTransporter();
};

// Check SMTP connection and authentication
export const verifyEmailConnection = async () => {
  try {
    const transporter = getTransporter();
    await transporter.verify();
    console.log("SMTP connection verified successfully");
    return true;
  } catch (error) {
    console.error("SMTP verification failed:", {
      code: error.code,
      command: error.command,
      message: error.message,
    });
    return false;
  }
};

// Diagnostic status check helper (safe to expose to diagnostics/health endpoints)
export const getSmtpStatus = async () => {
  const { user, pass } = getSmtpCredentials();
  const configured = Boolean(user && pass);

  let maskedUser = "Not configured";
  if (user) {
    const parts = user.split("@");
    if (parts.length === 2) {
      maskedUser = `${parts[0].slice(0, 3)}***@${parts[1]}`;
    } else {
      maskedUser = `${user.slice(0, 3)}***`;
    }
  }

  if (!configured) {
    return {
      ok: false,
      configured: false,
      message: "SMTP credentials missing. Please set SMTP_USER and SMTP_PASS in Vercel environment variables.",
      user: maskedUser,
    };
  }

  try {
    const transporter = getTransporter();
    await transporter.verify();
    return {
      ok: true,
      configured: true,
      message: "SMTP server verified and connected successfully.",
      user: maskedUser,
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT) || 465,
    };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      message: `SMTP verification failed: ${err.message}`,
      code: err.code || "UNKNOWN",
      user: maskedUser,
    };
  }
};

// Send email with timeout safeguard (essential for serverless)
export async function sendEmail({
  to,
  subject,
  text,
  html,
  attachments = [],
  from,
} = {}) {
  try {
    if (!to || (Array.isArray(to) && to.length === 0)) {
      throw new Error("Missing required email field: 'to'");
    }
    if (!subject) {
      throw new Error("Missing required email field: 'subject'");
    }
    if (!text && !html) {
      throw new Error("Missing required email fields: either 'text' or 'html' is required");
    }

    const { user } = getSmtpCredentials();
    const transporter = getTransporter();

    // Generate fallback text if html provided without text
    const plainText =
      text || (html ? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "");

    const sender = from || process.env.EMAIL_FROM || `"TaskVerse" <${user}>`;

    const mailOptions = {
      from: sender,
      to,
      subject,
      text: plainText,
      html,
    };

    if (Array.isArray(attachments) && attachments.length > 0) {
      mailOptions.attachments = attachments;
    }

    // Safety timeout: Never allow sendMail to hang the serverless function past 15 seconds
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("Email sending timed out after 15 seconds"));
      }, 15000);
    });

    const info = await Promise.race([transporter.sendMail(mailOptions), timeoutPromise]);

    console.log("Email accepted by SMTP server:", {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    });

    return info;
  } catch (error) {
    console.error("Email sending failed:", {
      code: error.code,
      command: error.command,
      responseCode: error.responseCode,
      message: error.message,
    });

    throw error;
  }
}

// Generate secure 6-digit OTP
export const generateOtp = () => {
  return randomInt(100000, 1000000).toString();
};

// Export proxy for backwards compatibility with direct imports of transporter
export const transporter = new Proxy({}, {
  get(target, prop) {
    const active = getTransporter();
    const val = active[prop];
    return typeof val === "function" ? val.bind(active) : val;
  },
});

