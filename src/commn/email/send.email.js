import { randomInt } from "node:crypto";

const RESEND_API_URL = "https://api.resend.com/emails";
const REQUEST_TIMEOUT_MS = 15000;

const getResendConfig = () => {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  const from = (
    process.env.RESEND_FROM_EMAIL ||
    process.env.EMAIL_FROM ||
    "TaskVerse <onboarding@resend.dev>"
  ).trim();

  return { apiKey, from };
};

/** Returns a safe configuration status without exposing the API key. */
export const getEmailStatus = () => {
  const { apiKey, from } = getResendConfig();
  return {
    ok: Boolean(apiKey),
    configured: Boolean(apiKey),
    provider: "Resend",
    from,
    message: apiKey
      ? "Resend API key is configured. Send a test email to verify delivery."
      : "RESEND_API_KEY is missing. Add it to the Vercel project environment variables.",
  };
};

/** Send email through Resend's HTTPS API (no SMTP sockets or DNS SMTP lookup). */
export async function sendEmail({
  to,
  subject,
  text,
  html,
  attachments = [],
  from,
  replyTo,
  cc,
  bcc,
} = {}) {
  if (!to || (Array.isArray(to) && to.length === 0)) {
    throw new Error("Missing required email field: 'to'");
  }
  if (!subject) throw new Error("Missing required email field: 'subject'");
  if (!text && !html) {
    throw new Error("Missing required email fields: either 'text' or 'html' is required");
  }

  const { apiKey, from: defaultFrom } = getResendConfig();
  if (!apiKey) {
    const error = new Error("RESEND_API_KEY is not configured. Add it in Vercel > Project Settings > Environment Variables.");
    error.code = "RESEND_NOT_CONFIGURED";
    throw error;
  }

  const payload = {
    from: from || defaultFrom,
    to: Array.isArray(to) ? to : [to],
    subject,
    ...(text ? { text } : {}),
    ...(html ? { html } : {}),
    ...(replyTo ? { reply_to: replyTo } : {}),
    ...(cc ? { cc: Array.isArray(cc) ? cc : [cc] } : {}),
    ...(bcc ? { bcc: Array.isArray(bcc) ? bcc : [bcc] } : {}),
  };

  if (Array.isArray(attachments) && attachments.length) {
    payload.attachments = attachments.map((attachment) => {
      if (attachment.content) {
        return {
          filename: attachment.filename || "attachment",
          content: Buffer.isBuffer(attachment.content)
            ? attachment.content.toString("base64")
            : attachment.content,
          ...(attachment.content_type || attachment.contentType
            ? { content_type: attachment.content_type || attachment.contentType }
            : {}),
        };
      }
      if (attachment.path) {
        throw new Error("Resend API attachments must be provided as content; filesystem paths are not supported in Vercel serverless functions.");
      }
      throw new Error("Unsupported attachment format for Resend. Provide filename and content.");
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = result.message || result.error || `Resend request failed with HTTP ${response.status}`;
      const error = new Error(message);
      error.code = result.name || `RESEND_HTTP_${response.status}`;
      error.statusCode = response.status;
      console.error("Resend email request failed:", {
        status: response.status,
        code: error.code,
        message: error.message,
      });
      throw error;
    }

    console.info("Email accepted by Resend:", {
      id: result.id,
      to: payload.to,
    });
    return {
      ...result,
      messageId: result.id,
      accepted: payload.to,
      rejected: [],
      response: "Accepted by Resend API",
    };
  } catch (error) {
    if (error.name === "AbortError") {
      error.message = `Resend email request timed out after ${REQUEST_TIMEOUT_MS}ms`;
      error.code = "RESEND_TIMEOUT";
    }
    console.error("Email sending failed:", {
      code: error.code || "RESEND_REQUEST_FAILED",
      message: error.message,
    });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export const generateOtp = () => randomInt(100000, 1000000).toString();
