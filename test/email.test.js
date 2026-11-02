import test from "node:test";
import assert from "node:assert/strict";
import { sendEmail, generateOtp, getEmailStatus } from "../src/commn/email/send.email.js";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.RESEND_API_KEY;
const originalFrom = process.env.RESEND_FROM_EMAIL;

test.after(() => {
  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalApiKey;
  if (originalFrom === undefined) delete process.env.RESEND_FROM_EMAIL;
  else process.env.RESEND_FROM_EMAIL = originalFrom;
});

test("Resend email helper posts the email through HTTPS API", async () => {
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.RESEND_FROM_EMAIL = "TaskVerse <onboarding@resend.dev>";
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({ id: "email_test_123" }), { status: 200 });
  };

  const result = await sendEmail({ to: "test@example.com", subject: "OTP", html: "<p>123456</p>" });
  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.Authorization, "Bearer re_test_key");
  assert.deepEqual(request.body.to, ["test@example.com"]);
  assert.equal(result.messageId, "email_test_123");
});

test("Resend helper fails clearly when API key is missing", async () => {
  delete process.env.RESEND_API_KEY;
  assert.equal(getEmailStatus().ok, false);
  await assert.rejects(
    sendEmail({ to: "test@example.com", subject: "OTP", text: "123456" }),
    { code: "RESEND_NOT_CONFIGURED" },
  );
});

test("OTP generator returns a six-digit string", () => {
  const otp = generateOtp();
  assert.match(otp, /^\d{6}$/);
});
