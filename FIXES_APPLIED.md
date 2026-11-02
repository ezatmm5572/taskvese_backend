# TaskVerse Backend – repair notes

## Changes made

- Fixed refresh-token issuance and validation by adding explicit `access` / `refresh` JWT types and requiring the correct token type on protected routes.
- Fixed refresh-token revocation key construction so both current `userId` and legacy `memberId` call sites resolve to the same Redis key.
- Added inactive-account rejection to authentication.
- Removed the obsolete in-memory email event queue. Transactional email calls are awaited directly by their request handlers so Vercel does not need background work after sending the HTTP response.
- Replaced Gmail SMTP / Nodemailer with the Mailjet HTTPS Email API.
- Made Redis initialization lazy, so importing the application or running unit tests without Redis credentials does not emit misleading initialization warnings. Redis-dependent operations return a clear configuration error when credentials are absent.
- Made missing MongoDB configuration fail with a clear startup error instead of starting an API that cannot serve data.
- Fixed encryption module import-time crashes when `ENCRYPTION_KEY_ENV` is missing and added explicit AES-256 key / ciphertext validation.
- Fixed the seed script's direct-execution guard so importing it no longer reads an undefined `process.argv[1]`.
- Scoped member, team, task, dashboard, export, and assignment reads to the signed-in user's own resources/team membership. Admin role alone no longer grants cross-admin tenant access.
- Restricted member update/delete/reset/deactivation operations to members created by the acting admin (while allowing users to update their own profile).
- Restricted standalone task assignments to the task creator or members managed by the same admin.
- Made CORS default to local development origins in development and deny browser origins in production unless `CORS_ORIGINS` is explicitly configured.
- Changed `npm start` so it no longer forces `NODE_ENV=development` in production.
- Added automated core regression tests and a `npm test` script.
- Removed the bundled local `config/.env.development` file from the repaired deliverable so credentials are not redistributed. Configure local and Vercel environment variables from `.env.example` instead.

## Verification performed

- All JavaScript files pass `node --check`.
- All application modules (excluding the executable `src/index.js` entry point) import successfully with test environment variables.
- All JavaScript files pass `node --check`.
- The Mailjet email helper tests pass (mocked HTTPS success, missing credentials handling, provider rejection handling, and six-digit OTP generation).
- The full existing test suite could not be rerun in this environment because dependency installation did not complete; run `npm ci` followed by `npm test` after extracting the project.

## Required deployment configuration

Set these in Vercel Project Settings → Environment Variables (and locally in an ignored `.env` file):

- `DB_URI`
- `JWT_SECRET` (long, random, private)
- `HASH_SALT` (bcrypt cost, e.g. `12`)
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `MAILJET_API_KEY` and `MAILJET_SECRET_KEY`
- `MAILJET_FROM_EMAIL` (the exact sender email address verified and activated in Mailjet; a custom domain is recommended but is not required if Mailjet accepts your verified individual sender)
- `CORS_ORIGINS` (comma-separated exact frontend origins; no `*`)
- `FRONTEND_URL`
- `CLOUD_NAME`, `API_KEY_CLOUDENARY`, `API_SECRET_CLOUDENARY` if uploads are enabled
- `ENCRYPTION_KEY_ENV` if application code uses the AES helper; it must be exactly 64 hexadecimal characters

Do not upload `.env` files or commit secrets. Rotate credentials that were present in the original archive because that archive contained a local environment file.

## Important limitation

The project was not connected to your live MongoDB, Upstash, Cloudinary, or Mailjet services during this repair. The code and local smoke tests were checked, but production integration (real email delivery, database operations, and Vercel deployment) still requires the environment variables above and a live deployment test.
