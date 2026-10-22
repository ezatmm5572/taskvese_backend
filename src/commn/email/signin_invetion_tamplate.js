
export const signInInvitationTemplate = ({
  memberName,
  memberEmail,
  memberPassword,
  signInUrl,
  invitedBy,
}) => {
  const escapeHtml = (value = "") =>
    String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]);

  const safe = (value, fallback = "Not specified") =>
    escapeHtml(value ?? fallback);

  const safeUrl = /^https?:\/\//i.test(signInUrl || "")
    ? escapeHtml(signInUrl)
    : null;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited to TaskVerse</title>
</head>

<body style="
  margin: 0;
  padding: 0;
  background-color: #f4f7fb;
  font-family: Arial, Helvetica, sans-serif;
">

  <div style="width: 100%; padding: 40px 0;">

    <div style="
      max-width: 520px;
      margin: auto;
      background-color: #ffffff;
      border-radius: 16px;
      padding: 40px 30px;
      text-align: center;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
      box-sizing: border-box;
    ">

      <!-- Logo -->
      <div style="
        font-size: 32px;
        font-weight: bold;
        color: #6c63ff;
        margin-bottom: 25px;
      ">
        TaskVerse
      </div>

      <!-- Title -->
      <h1 style="
        margin: 0 0 15px;
        color: #222222;
        font-size: 26px;
      ">
        You're Invited!
      </h1>

      <!-- Greeting -->
      <p style="
        margin: 0 auto 25px;
        color: #666666;
        font-size: 16px;
        line-height: 1.7;
      ">
        Hello ${safe(memberName, "there")}, your TaskVerse account
        is ready! You have been invited to join the platform.
        Use the credentials below to sign in.
      </p>

      <!-- Account Details -->
      <div style="
        background-color: #f0efff;
        border: 2px solid #6c63ff;
        border-radius: 12px;
        padding: 22px 20px;
        margin-bottom: 25px;
        text-align: left;
      ">

        <p style="
          margin: 0 0 18px;
          color: #6c63ff;
          font-size: 12px;
          font-weight: bold;
          letter-spacing: 1px;
          text-transform: uppercase;
        ">
          YOUR ACCOUNT DETAILS
        </p>

        <p style="
          margin: 0 0 8px;
          color: #555555;
          font-size: 14px;
          font-weight: bold;
        ">
          Email Address
        </p>

        <p style="
          margin: 0 0 20px;
          color: #29264a;
          font-size: 15px;
          overflow-wrap: anywhere;
        ">
          ${safe(memberEmail)}
        </p>

        <p style="
          margin: 0 0 8px;
          color: #555555;
          font-size: 14px;
          font-weight: bold;
        ">
          Password
        </p>

        <p style="
          margin: 0;
          color: #29264a;
          font-size: 15px;
          overflow-wrap: anywhere;
          font-family: monospace;
        ">
          ${safe(memberPassword)}
        </p>
      </div>

      <!-- Sign In Button -->
      ${
        safeUrl
          ? `<a href="${safeUrl}" style="
              display: inline-block;
              background-color: #6c63ff;
              color: #ffffff;
              text-decoration: none;
              font-size: 15px;
              font-weight: bold;
              padding: 15px 35px;
              border-radius: 10px;
              margin-bottom: 25px;
            ">
              Sign In to TaskVerse
            </a>`
          : ""
      }

      <!-- Instructions -->
      <p style="
        margin: 0 auto 25px;
        color: #777777;
        font-size: 14px;
        line-height: 1.7;
      ">
        ${
          invitedBy
            ? `You were invited by ${safe(invitedBy, "an administrator")}.`
            : "Sign in to access your account and start managing your tasks."
        }
        For your security, change your password after your first login.
      </p>

      <!-- Security Notice -->
      <div style="
        background-color: #fff8e6;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 25px;
        text-align: left;
      ">
        <p style="
          margin: 0;
          color: #806020;
          font-size: 13px;
          line-height: 1.6;
        ">
          <strong>Security reminder:</strong>
          Keep your login credentials private and do not share them
          with anyone.
        </p>
      </div>

      <!-- Footer -->
      <div style="
        padding-top: 20px;
        border-top: 1px solid #eeeeee;
      ">
        <p style="
          margin: 0 0 8px;
          color: #999999;
          font-size: 13px;
          line-height: 1.6;
        ">
          This is an automated invitation. Please do not reply.
        </p>

        <p style="
          margin: 0;
          color: #aaaaaa;
          font-size: 12px;
        ">
          © ${new Date().getFullYear()} TaskVerse. All rights reserved.
        </p>
      </div>

    </div>
  </div>

</body>
</html>
`;
};
