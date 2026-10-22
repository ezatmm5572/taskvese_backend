
export const emailTemplate = (otpCode) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email - Task Management System</title>
</head>

<body style="
    margin: 0;
    padding: 0;
    background-color: #f4f7fb;
    font-family: Arial, Helvetica, sans-serif;
">

    <div style="
        width: 100%;
        padding: 40px 0;
    ">

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
                font-size: 28px;
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
                Verify Your Email
            </h1>

            <!-- Description -->
            <p style="
                margin: 0 auto 30px;
                color: #666666;
                font-size: 16px;
                line-height: 1.6;
                max-width: 420px;
            ">
                Welcome to Task Management System! Use the verification
                code below to confirm your email address and activate your account.
            </p>

            <!-- OTP -->
            <div style="
                display: inline-block;
                background-color: #f0efff;
                border: 2px solid #6c63ff;
                border-radius: 12px;
                padding: 18px 35px;
                margin-bottom: 25px;
            ">
                <span style="
                    font-size: 32px;
                    font-weight: bold;
                    letter-spacing: 8px;
                    color: #6c63ff;
                ">
                    ${otpCode}
                </span>
            </div>

            <!-- Expiration -->
            <p style="
                margin: 0 0 25px;
                color: #777777;
                font-size: 14px;
            ">
                This code will expire in <strong>3 minutes</strong>.
            </p>

            <!-- Security Notice -->
            <div style="
                background-color: #fff7e6;
                border-radius: 10px;
                padding: 14px 18px;
                margin-bottom: 25px;
            ">
                <p style="
                    margin: 0;
                    color: #8a6500;
                    font-size: 13px;
                    line-height: 1.5;
                ">
                    🔒 For your security, never share this verification
                    code with anyone. Our team will never ask you for your OTP.
                </p>
            </div>

            <!-- Footer Description -->
            <p style="
                margin: 0;
                color: #999999;
                font-size: 13px;
                line-height: 1.5;
            ">
                If you didn't request this code, you can safely ignore
                this email. Your account security remains important to us.
            </p>

            <!-- Footer -->
            <div style="
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #eeeeee;
            ">
                <p style="
                    margin: 0;
                    color: #aaaaaa;
                    font-size: 12px;
                ">
                    © ${new Date().getFullYear()} Task Management System.
                    All rights reserved.
                </p>
            </div>

        </div>

    </div>

</body>
</html>
`;
};
