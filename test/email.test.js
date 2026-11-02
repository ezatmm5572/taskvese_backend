import test from "node:test";
import assert from "node:assert/strict";
import { sendEmail, generateOtp, getEmailStatus } from "../src/commn/email/send.email.js";

const originalFetch = globalThis.fetch;
const envNames = ["MAILJET_API_KEY", "MAILJET_SECRET_KEY", "MAILJET_FROM_EMAIL", "MAILJET_FROM_NAME"];
const originalEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));

test.after(() => {
  globalThis.fetch = originalFetch;
  for (const name of envNames) {
    if (originalEnv[name] === undefined) delete process.env[name];
    else process.env[name] = originalEnv[name];
  }
});

test("Mailjet helper posts email through Send API v3.1 using Basic Auth", async () => {
  process.env.MAILJET_API_KEY = "public_test_key";
  process.env.MAILJET_SECRET_KEY = "private_test_key";
  process.env.MAILJET_FROM_EMAIL = "sender@example.com";
  process.env.MAILJET_FROM_NAME = "TaskVerse";
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({
      Messages: [{ Status: "success", To: [{ Email: "test@example.com", MessageID: 12345 }] }],
    }), { status: 200 });
  };

  const result = await sendEmail({ to: "test@example.com", subject: "OTP", html: "<p>123456</p>" });
  assert.equal(request.url, "https://api.mailjet.com/v3.1/send");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.Authorization,
    `Basic ${Buffer.from("public_test_key:private_test_key").toString("base64")}`);
  assert.deepEqual(request.body.Messages[0].To, [{ Email: "test@example.com" }]);
  assert.equal(request.body.Messages[0].From.Email, "sender@example.com");
  assert.equal(result.messageId, 12345);
});

test("Mailjet helper fails clearly when credentials are missing", async () => {
  delete process.env.MAILJET_API_KEY;
  assert.equal(getEmailStatus().ok, false);
  await assert.rejects(
    sendEmail({ to: "test@example.com", subject: "OTP", text: "123456" }),
    { code: "MAILJET_NOT_CONFIGURED" },
  );
});

test("Mailjet helper surfaces provider rejection", async () => {
  process.env.MAILJET_API_KEY = "public_test_key";
  process.env.MAILJET_SECRET_KEY = "private_test_key";
  process.env.MAILJET_FROM_EMAIL = "sender@example.com";
  globalThis.fetch = async () => new Response(JSON.stringify({
    Messages: [{ Status: "error", Errors: [{ ErrorCode: "sender_not_active", ErrorMessage: "Sender is not active" }] }],
  }), { status: 200 });
  await assert.rejects(
    sendEmail({ to: "test@example.com", subject: "OTP", text: "123456" }),
    { code: "sender_not_active" },
  );
});

test("OTP generator returns a six-digit string", () => {
  assert.match(generateOtp(), /^\d{6}$/);
});
