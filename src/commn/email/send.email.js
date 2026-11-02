
import nodemailer from "nodemailer";
import { randomInt } from "node:crypto";
import { SMTP_PASS, SMTP_USER } from "../../../config/config.env.js";

// Lazy transporter singleton
let cachedTransporter = null;

// Get configured SMTP transporter with sanitized credentials
export const getTransporter = () => {
  const user = (process.env.SMTP_USER || SMTP_USER || "").trim();
  const rawPass = process.env.SMTP_PASS || SMTP_PASS || "";
  // Google App Passwords often contain spaces (e.g. 'xxxx xxxx xxxx xxxx'); remove all spaces
  const pass = rawPass.replace(/\s+/g, "");

  if (!user || !pass) {
    throw new Error("SMTP credentials missing: SMTP_USER and SMTP_PASS must be configured");
  }

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
    });
  }

  return cachedTransporter;
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

// Send email
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

    const transporter = getTransporter();
    const user = (process.env.SMTP_USER || SMTP_USER || "").trim();

    // Generate fallback text if html provided without text
    const plainText = text || (html ? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "");

    const mailOptions = {
      from: from || `"TaskVerse" <${user}>`,
      to,
      subject,
      text: plainText,
      html,
    };

    if (Array.isArray(attachments) && attachments.length > 0) {
      mailOptions.attachments = attachments;
    }

    const info = await transporter.sendMail(mailOptions);

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

