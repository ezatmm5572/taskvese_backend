# TaskVerse email setup (Mailjet)

TaskVerse sends transactional email through the Mailjet Send API v3.1 over HTTPS. Gmail SMTP/Nodemailer and Resend are not used by this integration.

## 1. Create a free Mailjet account

1. Sign up at https://www.mailjet.com/.
2. Complete any account activation steps Mailjet requests.
3. Open the API Key Management page and copy both the API Key (public key) and Secret Key (private key).
4. Keep the Secret Key private. Never commit either credential to GitHub.

## 2. Verify a sender email (no custom domain required for this setup)

1. In Mailjet, open Account Settings / Senders & Domains.
2. Add a sender address that you control and can receive verification mail at (for example, your own Gmail address).
3. Open the verification email and confirm the sender address.
4. Use that exact verified address as `MAILJET_FROM_EMAIL`.

Mailjet requires the From address to be a validated and active sender. A custom domain is recommended for production deliverability, but this code does not require one if Mailjet allows your account to use a verified individual sender address. Account approval, sending limits, and anti-abuse restrictions are controlled by Mailjet.

## 3. Configure Vercel

In the active Vercel project (`taskvese_backend`), add these variables to **Production** (and Preview/Development if needed):

- `MAILJET_API_KEY` = Mailjet public API key
- `MAILJET_SECRET_KEY` = Mailjet private Secret Key
- `MAILJET_FROM_EMAIL` = exact verified sender address, e.g. `almsryabwzt@gmail.com`
- `MAILJET_FROM_NAME` = `TaskVerse`

Redeploy after saving the variables. Do not put these values in frontend variables or commit them to GitHub.

## 4. Verify configuration and test

Open:

`https://YOUR-BACKEND-DOMAIN/public/email-status`

A configured response reports `provider: "Mailjet"` and `ok: true`. This checks that all three required settings exist; it does not make a live send or prove Mailjet has activated the sender.

Then test signup / resend OTP / forgot password. The API waits for Mailjet to accept the email before returning success. Check Mailjet's message activity/logs and the recipient's Spam folder if the message is delayed.

## Notes

- Mailjet Send API v3.1 uses HTTP Basic authentication with the public API key as username and the Secret Key as password.
- A successful API acceptance is not a guarantee of inbox placement.
- Native Node.js `fetch` is used; no extra email SDK dependency is required.
