import { randomInt } from "node:crypto";

const MAILJET_API_URL = "https://api.mailjet.com/v3.1/send";
const REQUEST_TIMEOUT_MS = 15000;

const getMailjetConfig = () => ({
  apiKey: (process.env.MAILJET_API_KEY || "").trim(),
  secretKey: (process.env.MAILJET_SECRET_KEY || "").trim(),
  fromEmail: (process.env.MAILJET_FROM_EMAIL || "").trim(),
  fromName: (process.env.MAILJET_FROM_NAME || "TaskVerse").trim(),
});

const parseAddress = (value, fallbackName = "TaskVerse") => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("MAILJET_FROM_EMAIL must be a verified sender email address.");
  }

  const match = value.trim().match(/^(.*?)\s*<([^<>]+)>$/);
  if (match) {
    return {
      Email: match[2].trim(),
      Name: match[1].trim().replace(/^['"]|['"]$/g, "") || fallbackName,
    };
  }

  return { Email: value.trim(), Name: fallbackName };
};

const normalizeRecipients = (value) => {
  const recipients = Array.isArray(value) ? value : [value];
  return recipients.map((recipient) => {
    if (typeof recipient === "string") return { Email: recipient };
    if (recipient && typeof recipient === "object" && recipient.email) {
      return { Email: recipient.email, ...(recipient.name ? { Name: recipient.name } : {}) };
    }
    throw new Error("Invalid email recipient. Provide an email string or { email, name } object.");
  });
};

/** Returns configuration state without exposing the Mailjet secret key. */
export const getEmailStatus = () => {
  const config = getMailjetConfig();
  const configured = Boolean(config.apiKey && config.secretKey && config.fromEmail);
  return {
    ok: configured,
    configured,
    provider: "Mailjet",
    from: config.fromEmail ? `${config.fromName} <${config.fromEmail}>` : null,
    message: configured
      ? "Mailjet API credentials and sender are configured. This does not verify that Mailjet has activated the sender."
      : "Set MAILJET_API_KEY, MAILJET_SECRET_KEY, and MAILJET_FROM_EMAIL in the environment.",
  };
};

/** Send email through Mailjet Send API v3.1 over HTTPS (no SMTP connection). */
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

  const config = getMailjetConfig();
  if (!config.apiKey || !config.secretKey || !config.fromEmail) {
    const error = new Error(
      "Mailjet is not configured. Set MAILJET_API_KEY, MAILJET_SECRET_KEY, and MAILJET_FROM_EMAIL in Vercel Environment Variables."
    );
    error.code = "MAILJET_NOT_CONFIGURED";
    throw error;
  }

  const sender = from
    ? parseAddress(from, config.fromName)
    : { Email: config.fromEmail, Name: config.fromName };

  const message = {
    From: sender,
    To: normalizeRecipients(to),
    Subject: subject,
    ...(text ? { TextPart: text } : {}),
    ...(html ? { HTMLPart: html } : {}),
  };

  if (cc) message.Cc = normalizeRecipients(cc);
  if (bcc) message.Bcc = normalizeRecipients(bcc);
  if (replyTo) message.ReplyTo = parseAddress(replyTo, config.fromName);

  if (Array.isArray(attachments) && attachments.length) {
    message.Attachments = attachments.map((attachment) => {
      if (!attachment?.content) {
        throw new Error("Mailjet attachments must be provided as content; filesystem paths are not supported.");
      }
      return {
        Filename: attachment.filename || "attachment",
        ContentType: attachment.content_type || attachment.contentType || "application/octet-stream",
        Base64Content: Buffer.isBuffer(attachment.content)
          ? attachment.content.toString("base64")
          : attachment.content,
      };
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const authorization = Buffer.from(`${config.apiKey}:${config.secretKey}`).toString("base64");

  try {
    const response = await fetch(MAILJET_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authorization}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ Messages: [message] }),
      signal: controller.signal,
    });

    const result = await response.json().catch(() => ({}));
    const mailjetMessage = result.Messages?.[0];
    const firstRecipient = mailjetMessage?.To?.[0];

    if (!response.ok || mailjetMessage?.Status === "error") {
      const providerError = mailjetMessage?.Errors?.[0];
      const messageText = providerError?.ErrorMessage || result.ErrorMessage ||
        `Mailjet request failed with HTTP ${response.status}`;
      const error = new Error(messageText);
      error.code = providerError?.ErrorCode || `MAILJET_HTTP_${response.status}`;
      error.statusCode = response.status;
      console.error("Mailjet email request failed:", {
        status: response.status,
        code: error.code,
        message: error.message,
      });
      throw error;
    }

    if (mailjetMessage?.Status !== "success") {
      const error = new Error("Mailjet did not confirm that the message was accepted.");
      error.code = "MAILJET_UNCONFIRMED_RESPONSE";
      throw error;
    }

    const accepted = message.To.map((recipient) => recipient.Email);
    console.info("Email accepted by Mailjet:", {
      messageId: firstRecipient?.MessageID,
      to: accepted,
    });

    return {
      ...result,
      messageId: firstRecipient?.MessageID || firstRecipient?.MessageUUID,
      accepted,
      rejected: [],
      response: "Accepted by Mailjet API",
    };
  } catch (error) {
    if (error.name === "AbortError") {
      error.message = `Mailjet request timed out after ${REQUEST_TIMEOUT_MS}ms`;
      error.code = "MAILJET_TIMEOUT";
    }
    console.error("Email sending failed:", {
      code: error.code || "MAILJET_REQUEST_FAILED",
      message: error.message,
    });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export const generateOtp = () => randomInt(100000, 1000000).toString();
