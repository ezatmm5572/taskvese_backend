# TaskVerse email setup (Resend)

TaskVerse sends transactional email through the Resend HTTPS API. Gmail SMTP/Nodemailer is no longer used.

## 1. Create a Resend API key

1. Create/sign in to an account at https://resend.com/.
2. Open **API Keys** and create a key with permission to send email.
3. Copy the key. It is shown only when created.

## 2. Configure the sender

For a quick initial test, Resend provides `onboarding@resend.dev`. This test sender is restricted by Resend and is generally suitable only for sending to the email address associated with your Resend account.

For real users / production:

1. Add a domain you own in Resend under **Domains**.
2. Add the DNS records Resend provides at your domain DNS provider.
3. Wait until Resend marks the domain as verified.
4. Set the sender to an address on that verified domain, for example `TaskVerse <no-reply@yourdomain.com>`.

Do not use an address on a domain you do not own or have not verified.

## 3. Set Vercel environment variables

In the active Vercel project (`taskvese_backend`):

- `RESEND_API_KEY` = the API key copied from Resend
- `RESEND_FROM_EMAIL` = `TaskVerse <onboarding@resend.dev>` for the initial restricted test, or an address on your verified domain for production

Add the variables to **Production** (and Preview/Development if those environments are used), then redeploy the project so the new values are available to the function.

Remove the old `SMTP_USER`, `SMTP_PASS`, `SMTP_HOST`, `SMTP_PORT`, and `SMTP_SECURE` variables after confirming the new integration works; they are no longer read by this code.

## 4. Verify configuration

After deployment, open:

`https://YOUR-BACKEND-DOMAIN/public/email-status`

A configured response reports `provider: "Resend"` and `ok: true`. This checks that the API key exists; it does not send a test email or guarantee that the sender domain is verified.

Then test signup / resend OTP / forgot password. The API waits for Resend to accept the email before returning a success response. A Resend rejection is returned as `EMAIL_SEND_FAILED` by the auth flow and is logged with its HTTP status/code.

## Notes

- Resend accepting an email means it accepted the request for delivery; it does not guarantee inbox placement. Check Resend **Logs** and the recipient's spam folder if delivery is delayed.
- Never commit `RESEND_API_KEY` to GitHub or put it in frontend environment variables.
- Native Node.js `fetch` is used, so no additional email SDK dependency is required.
