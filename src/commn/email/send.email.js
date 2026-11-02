
import nodemailer from "nodemailer";
import { randomInt } from "node:crypto";
import { SMTP_PASS, SMTP_USER } from "../../../config/config.env.js";

if (!SMTP_USER || !SMTP_PASS) {
  throw new Error("SMTP_USER or SMTP_PASS is missing");
}

const transporter = nodemailer.createTransport({
  service: "gmail",

  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },

  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 30000,
});

// Check SMTP connection and authentication
export const verifyEmailConnection = async () => {
  try {
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
} = {}) {
  try {
    if (!to || !subject || (!text && !html)) {
      throw new Error("Missing required email fields");
    }

    const info = await transporter.sendMail({
      from: `"TaskVerse" <${SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    });

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
