import { HASH_SALT, JWT_SECRET } from "../../../config/config.env.js";
import * as DB_services from "../../DB/DB.service.js";
import memberModel from "../../DB/models/member.js";
import sessionModel from "../../DB/models/session.js";
import emailEventEmitter from "../../commn/email/email.events.js";
import * as redis_service from "../../DB/redis/redise.service.js";
import { emailTemplate } from "../../commn/email/email_otp.teamplate.js";
import { compareSync, hashSync } from "bcrypt";
import { sendEmail, generateOtp } from "../../commn/email/send.email.js";
import { ProviderEnum, RoleEnum } from "../../commn/enums/member.enums.js";
import { fileUpload } from "../../commn/utils/fileUpload.js";
import { eventsEnum } from "../../commn/enums/eventsEnum.js";
import { generateToken } from "../../commn/utils/security/token.service.js";
import { v4 as uuidv4 } from "uuid";
import { successResponse } from "../../commn/utils/successResponse.js";
import { OAuth2Client } from "google-auth-library";
import { httpError } from "../../commn/utils/permissions.js";

const confirmEmail = async ({ email, otp }) => {
    const verifyEmail = await DB_services.findOne({
        model: memberModel,
        filter: { email, provider: ProviderEnum.SYSTEM, confirmed: false },
        select: "-password",
    });
    if (!verifyEmail) {
        throw httpError("User not found or email already confirmed", 404, "USER_NOT_FOUND");
    }

    const storedOtp = await redis_service.getValuse({
        key: redis_service.otp_key({ email: verifyEmail.email }),
    });

    if (!storedOtp) {
        throw httpError("OTP expired or not found", 400, "OTP_EXPIRED");
    }

    const verifyOtp = compareSync(`${otp}`, storedOtp);
    if (!verifyOtp) {
        throw httpError("Invalid OTP", 400, "OTP_INVALID");
    }
    await DB_services.updateDocument({
        model: memberModel,
        filter: { email: verifyEmail.email },
        update: { confirmed: true },
    });
    redis_service.delValuse([redis_service.otp_key({ email: verifyEmail.email })]);
};

export const adminSignUp = async (req, res) => {
    const { fname, lname, email, password, confirmPassword, gender, profilePicture } = req.body;
    if (password !== confirmPassword) {
        throw httpError("Password and confirm password do not match", 422, "VALIDATION_ERROR");
    }

    const user = await DB_services.findOne({ model: memberModel, filter: { email } });
    if (user) {
        throw httpError("Member already exists", 409, "MEMBER_EXISTS");
    }

    const encPassword = hashSync(password, Number(HASH_SALT) || 12);

    let uploadedFile = null;
    if (req.file) {
        uploadedFile = await fileUpload(req.file.buffer, "members");
    }
    const member = await DB_services.createDocument({
        model: memberModel,
        doc: {
            fname,
            lname,
            email,
            password: encPassword,
            gender,
            role: RoleEnum.ADMIN,
            profilePicture: uploadedFile?.secure_url || "default.png",
            confirmed: false,
        },
    });

    const isBlocked = await redis_service.getValuse({
        key: redis_service.blocked_key({ email: email }),
    });
    if (isBlocked) {
        throw httpError("Member is temporarily blocked due to excessive attempts", 429, "RATE_LIMITED");
    }

    const otp = await generateOtp();
    redis_service.setValuse({
        key: redis_service.otp_key({ email: email }),
        value: hashSync(`${otp}`, Number(HASH_SALT) || 12),
        ttl: 60 * 10,
    });

    try {
        await sendEmail({
            to: email,
            subject: "confirm email",
            html: emailTemplate(otp),
        });
    } catch (emailErr) {
        console.error("Failed to send confirmation email on admin sign up:", emailErr?.message || emailErr);
        await memberModel.findByIdAndDelete(member._id).catch(() => {});
        throw httpError(
            `Failed to send verification email: ${emailErr?.message || "SMTP error"}. In Vercel, please ensure SMTP_USER and SMTP_PASS (Gmail App Password) are set in Project Settings > Environment Variables.`,
            500,
            "EMAIL_SEND_FAILED"
        );
    }

    // OTP limit Counter
    redis_service.setValuse({
        key: redis_service.counter_key({ email: email }),
        value: 0,
        ttl: 60 * 30,
    });

    successResponse({
        res,
        status: 201,
        message: "Admin user created successfully",
        data: { email: email },
    });
};

export const confirmSignUp = async (req, res) => {
    const { email, otp } = req.body;
    await confirmEmail({ email, otp });
    successResponse({
        res,
        status: 200,
        message: "Email confirmed successfully",
    });
};

export const resendOtp = async (req, res) => {
    const { email } = req.body;

    const blocked = await redis_service.getValuse({ key: redis_service.blocked_key({ email }) });
    if (blocked) {
        throw httpError(
            "You have exceeded the maximum number of attempts, please try again later",
            429,
            "RATE_LIMITED"
        );
    }
    const counter = await redis_service.getValuse({ key: redis_service.counter_key({ email }) });
    if (counter >= 3) {
        redis_service.setValuse({
            key: redis_service.blocked_key({ email }),
            value: true,
            ttl: 60 * 10,
        });
        throw httpError(
            "You have exceeded the maximum number of attempts, please try again in 10 minutes",
            429,
            "RATE_LIMITED"
        );
    }
    const verifyEmail = await DB_services.findOne({
        model: memberModel,
        filter: { email, provider: ProviderEnum.SYSTEM, confirmed: false },
        select: "-password",
    });
    if (!verifyEmail) {
        throw httpError("User not found or already confirmed", 404, "USER_NOT_FOUND");
    }
    const otp = await generateOtp();
    redis_service.setValuse({
        key: redis_service.otp_key({ email: verifyEmail.email }),
        value: hashSync(`${otp}`, Number(HASH_SALT) || 12),
        ttl: 60 * 15,
    });

    try {
        await sendEmail({
            to: verifyEmail.email,
            subject: "confirm email",
            html: emailTemplate(otp),
        });
    } catch (emailErr) {
        console.error("Failed to resend confirmation email:", emailErr?.message || emailErr);
        throw httpError(
            `Failed to send verification email: ${emailErr?.message || "SMTP error"}. Please check SMTP configuration in Vercel.`,
            500,
            "EMAIL_SEND_FAILED"
        );
    }
    redis_service.incrementValuse({ key: redis_service.counter_key({ email: verifyEmail.email }) });
    successResponse({
        res,
        status: 200,
        message: "Otp sent successfully",
    });
};

export const signUpWithG = async (req, res, next) => {
    const { idToken } = req.body;

    if (!idToken) {
        throw httpError("Google ID token is required", 400, "VALIDATION_ERROR");
    }

    const client = new OAuth2Client(
        "882940930891-civns95juvot511h26l0bv894o5ra5h9.apps.googleusercontent.com"
    );

    const ticket = await client.verifyIdToken({
        idToken,
        audience: "882940930891-civns95juvot511h26l0bv894o5ra5h9.apps.googleusercontent.com",
    });

    const payload = ticket.getPayload();
    if (!payload) {
        throw httpError("Invalid Google token", 401, "INVALID_TOKEN");
    }

    const { email, email_verified, name, picture } = payload;
    if (!email || !email_verified) {
        throw httpError("Google email is not verified", 400, "VALIDATION_ERROR");
    }

    const nameParts = (name || "Google User").trim().split(/\s+/);
    const fname = nameParts.shift() || "Google";
    const lname = nameParts.join(" ") || "User";

    let member = await DB_services.findOne({
        model: memberModel,
        filter: { email },
    });

    if (member && member.provider === ProviderEnum.SYSTEM) {
        throw httpError(
            "Email already exists. Please sign in using your password.",
            409,
            "MEMBER_EXISTS"
        );
    }

    if (!member) {
        member = await DB_services.createDocument({
            model: memberModel,
            doc: {
                fname,
                lname,
                email,
                confirmed: true,
                profilePicture: picture || "default.png",
                provider: ProviderEnum.GOOGLE,
                role: RoleEnum.ADMIN,
            },
        });
    }

    if (member.active === false) {
        throw httpError("Your account is deactivated. Contact an administrator.", 403, "ACCOUNT_DEACTIVATED");
    }

    const token = await generateToken({
        payload: {
            id: member._id,
            email: member.email,
        },
        secret_key: JWT_SECRET,
        options: {
            expiresIn: 60 * 20,
            jwtid: uuidv4(),
        },
    });

    const refreshJti = uuidv4();
    const refreshToken = await generateToken({
        payload: {
            id: member._id,
            email: member.email,
        },
        secret_key: JWT_SECRET,
        options: {
            expiresIn: 60 * 60 * 24 * 7,
            jwtid: refreshJti,
        },
    });

    return successResponse({
        res,
        status: 200,
        message: "Login successfully",
        data: {
            accessToken: token,
            refreshToken,
        },
    });
};

export const signIn = async (req, res, next) => {
    const { email, password } = req.body;
    const member = await DB_services.findOne({
        model: memberModel,
        filter: { email },
    });
    if (!member) {
        throw httpError("User not found", 404, "USER_NOT_FOUND");
    }

    // Section 2.1 Contract Fix: unconfirmed accounts MUST return 403 EMAIL_NOT_CONFIRMED
    if (member.provider === ProviderEnum.SYSTEM && !member.confirmed) {
        throw httpError("Email not confirmed", 403, "EMAIL_NOT_CONFIRMED");
    }

    if (member.active === false) {
        throw httpError("Account is deactivated. Please contact an administrator.", 403, "ACCOUNT_DEACTIVATED");
    }

    const verifyPassword = compareSync(password, member.password);
    if (!verifyPassword) {
        throw httpError("Invalid password", 401, "INVALID_PASSWORD");
    }

    const token = await generateToken({
        payload: { id: member._id, email: member.email },
        secret_key: JWT_SECRET,
        options: {
            expiresIn: 60 * 20,
            jwtid: uuidv4(),
        },
    });

    const refreshJti = uuidv4();
    const refreshToken = await generateToken({
        payload: { id: member._id, email: member.email },
        secret_key: JWT_SECRET,
        options: {
            expiresIn: 60 * 60 * 24 * 7,
            jwtid: refreshJti,
        },
    });

    try {
        await sessionModel.create({
            member: member._id,
            refreshTokenHash: hashSync(refreshJti, Number(HASH_SALT) || 12),
            userAgent: req.headers["user-agent"] || "",
            ip: req.ip || "",
        });
    } catch (e) {}

    successResponse({
        res,
        status: 200,
        message: "login successfully",
        data: { accessToken: token, refreshToken },
    });
};

export const refreshToken = async (req, res, next) => {
    const { jti, exp } = req.decoded;
    const member = req.member;

    if (!member) {
        throw httpError("User not found", 404, "USER_NOT_FOUND");
    }

    if (!jti || !exp) {
        throw httpError("Invalid refresh token", 401, "INVALID_TOKEN");
    }

    // Section 2.6 Contract Fix: If same token was used within 10s (concurrent tab refreshes),
    // return the cached token pair instead of revoking and logging out.
    try {
        const cachedTokens = await redis_service.getValuse({
            key: redis_service.recent_refresh_key({
                userId: member._id,
                jti,
            }),
        });

        if (cachedTokens && cachedTokens.accessToken && cachedTokens.refreshToken) {
            return successResponse({
                res,
                status: 200,
                message: "Tokens refreshed successfully",
                data: cachedTokens,
            });
        }
    } catch (e) {}

    const isRevoked = await redis_service.getValuse({
        key: redis_service.revoke_key({
            userId: member._id,
            jti,
        }),
    });

    if (isRevoked) {
        throw httpError("Invalid refresh token", 401, "INVALID_TOKEN");
    }

    const token = generateToken({
        payload: {
            id: member._id,
            email: member.email,
        },
        secret_key: JWT_SECRET,
        options: {
            expiresIn: "20m",
            jwtid: uuidv4(),
        },
    });

    const newRefreshJti = uuidv4();
    const newRefreshToken = generateToken({
        payload: {
            id: member._id,
            email: member.email,
        },
        secret_key: JWT_SECRET,
        options: {
            expiresIn: "7d",
            jwtid: newRefreshJti,
        },
    });

    const ttl = exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
        await redis_service.setValuse({
            key: redis_service.revoke_key({
                userId: member._id,
                jti,
            }),
            value: jti,
            ttl,
        });
    }

    // Cache the pair for 10 seconds for idempotency
    try {
        await redis_service.setValuse({
            key: redis_service.recent_refresh_key({
                userId: member._id,
                jti,
            }),
            value: {
                accessToken: token,
                refreshToken: newRefreshToken,
            },
            ttl: 10,
        });
    } catch (e) {}

    successResponse({
        res,
        status: 200,
        message: "Tokens refreshed successfully",
        data: {
            accessToken: token,
            refreshToken: newRefreshToken,
        },
    });
};

export const logout = async (req, res) => {
    const member = req.member;
    const { flag } = req.query;
    if (!member) {
        throw httpError("User not found", 404, "USER_NOT_FOUND");
    }
    if (flag === "all") {
        req.member.changeCredentials = new Date();
        await req.member.save();
        await redis_service.delValuse(
            await redis_service.keys(redis_service.get_revoke_key({ memberId: member._id }))
        );
        successResponse({
            res,
            status: 200,
            message: "Logout successfully",
        });
    } else {
        await redis_service.setValuse({
            key: redis_service.revoke_key({ memberId: member._id, jti: req.decoded.jti }),
            value: `${req.decoded.jti}`,
            ttl: req.decoded.exp - Math.floor(Date.now() / 1000),
        });
        successResponse({
            res,
            status: 200,
            message: "Logout successfully",
        });
    }
};

export const getProfile = async (req, res, next) => {
    const member = req.member;
    if (!member) {
        throw httpError("User not found", 404, "USER_NOT_FOUND");
    }
    const profile = await DB_services.findOne({
        model: memberModel,
        filter: { _id: member._id },
        select: "-password",
    });
    successResponse({
        res,
        status: 200,
        message: "Profile",
        data: profile,
    });
};

export const forgetPassword = async (req, res, next) => {
    const { email } = req.body;
    const member = await DB_services.findOne({ model: memberModel, filter: { email, confirmed: true } });
    if (!member) {
        throw httpError("User not found", 404, "USER_NOT_FOUND");
    }
    const otp = await generateOtp();
    await redis_service.setValuse({
        key: redis_service.otp_key({ email: member.email }),
        value: hashSync(`${otp}`, Number(HASH_SALT) || 12),
        ttl: 60 * 15,
    });
    try {
        await sendEmail({
            to: member.email,
            subject: "confirm email",
            html: emailTemplate(otp),
        });
    } catch (emailErr) {
        console.error("Failed to send password reset OTP email:", emailErr?.message || emailErr);
        throw httpError(
            `Failed to send password reset email: ${emailErr?.message || "SMTP error"}. Please check SMTP configuration in Vercel.`,
            500,
            "EMAIL_SEND_FAILED"
        );
    }
    await redis_service.incrementValuse({ key: redis_service.counter_key({ email: member.email }) });

    await redis_service.setValuse({
        key: redis_service.forgot_password_key({ email }),
        value: hashSync(`${otp}`, Number(HASH_SALT) || 12),
        ttl: 60 * 15,
    });
    successResponse({
        res,
        status: 200,
        message: "Otp sent successfully",
    });
};

export const resetPassword = async (req, res, next) => {
    const { email, otp, password, confirmPassword } = req.body;
    if (password !== confirmPassword) {
        throw httpError("Password and confirm password do not match", 422, "VALIDATION_ERROR");
    }

    const forgot_password_otp = await redis_service.getValuse({
        key: redis_service.forgot_password_key({ email }),
    });
    if (!forgot_password_otp) {
        throw httpError("OTP expired or not found", 400, "OTP_EXPIRED");
    }
    const verifyOtp = compareSync(otp, forgot_password_otp);
    if (!verifyOtp) {
        throw httpError("Invalid OTP", 400, "OTP_INVALID");
    }
    const member = await DB_services.findOne({ model: memberModel, filter: { email, confirmed: true } });
    if (!member) {
        throw httpError("User not found", 404, "USER_NOT_FOUND");
    }
    const hashPassword = hashSync(password, Number(HASH_SALT) || 12);
    await DB_services.updateDocument({
        model: memberModel,
        filter: { email, confirmed: true },
        update: { password: hashPassword, changeCredentials: new Date() },
    });
    await redis_service.delValuse([redis_service.forgot_password_key({ email })]);
    await redis_service.delValuse([redis_service.counter_key({ email })]);
    await redis_service.delValuse([redis_service.otp_key({ email })]);
    successResponse({
        res,
        status: 200,
        message: "Password changed successfully",
    });
};

export const changePassword = async (req, res, next) => {
    const member = req.member;
    const { oldPassword, newPassword, confirmPassword } = req.body;
    if (newPassword !== confirmPassword) {
        throw httpError("New password and confirm password do not match", 422, "VALIDATION_ERROR");
    }
    if (!member) {
        throw httpError("User not found", 404, "USER_NOT_FOUND");
    }
    const member1 = await DB_services.findOne({
        model: memberModel,
        filter: { _id: member._id },
    });
    const verifyPassword = compareSync(oldPassword, member1.password);
    if (!verifyPassword) {
        throw httpError("Invalid old password", 401, "INVALID_PASSWORD");
    }
    const hashPassword = hashSync(newPassword, Number(HASH_SALT) || 12);
    await DB_services.updateDocument({
        model: memberModel,
        filter: { _id: member._id },
        update: { password: hashPassword, changeCredentials: new Date() },
    });

    await redis_service.delValuse(
        await redis_service.keys(redis_service.get_revoke_key({ memberId: member._id }))
    );
    successResponse({
        res,
        status: 200,
        message: "Password changed successfully",
    });
};

// -------------------------------------------------------------
// Section 4.10: Sessions, Change Email, Account Deletion
// -------------------------------------------------------------

export const getSessions = async (req, res, next) => {
    const sessions = await sessionModel
        .find({ member: req.member._id, revokedAt: null })
        .sort({ lastUsedAt: -1 });

    const formatted = sessions.map((s) => ({
        _id: s._id,
        userAgent: s.userAgent,
        ip: s.ip,
        createdAt: s.createdAt,
        lastUsedAt: s.lastUsedAt,
        current: (req.headers["user-agent"] || "") === s.userAgent && (req.ip || "") === s.ip,
    }));

    successResponse({
        res,
        status: 200,
        message: "Active sessions",
        data: formatted,
    });
};

export const revokeSession = async (req, res, next) => {
    const { sessionId } = req.params;
    const session = await sessionModel.findOneAndUpdate(
        { _id: sessionId, member: req.member._id },
        { revokedAt: new Date() },
        { new: true }
    );
    if (!session) {
        throw httpError("Session not found", 404, "NOT_FOUND");
    }
    successResponse({
        res,
        status: 200,
        message: "Session revoked successfully",
        data: { _id: sessionId },
    });
};

export const changeEmail = async (req, res, next) => {
    const { password, newEmail } = req.body;
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        throw httpError("A valid new email is required", 422, "VALIDATION_ERROR");
    }

    const member = await memberModel.findById(req.member._id);
    if (!member) throw httpError("User not found", 404, "USER_NOT_FOUND");

    const validPass = compareSync(password, member.password);
    if (!validPass) {
        throw httpError("Invalid password", 401, "INVALID_PASSWORD");
    }

    const exists = await memberModel.findOne({ email: newEmail.toLowerCase() });
    if (exists) {
        throw httpError("Email is already in use", 409, "MEMBER_EXISTS");
    }

    const otp = await generateOtp();
    await redis_service.setValuse({
        key: `change_email::${member._id}::${newEmail.toLowerCase()}`,
        value: hashSync(`${otp}`, Number(HASH_SALT) || 12),
        ttl: 60 * 15,
    });

    try {
        await sendEmail({
            to: newEmail,
            subject: "Verify your new email address",
            html: emailTemplate(otp),
        });
    } catch (emailErr) {
        console.error("Failed to send change email OTP:", emailErr?.message || emailErr);
        throw httpError(
            `Failed to send email: ${emailErr?.message || "SMTP error"}. Please check SMTP configuration in Vercel.`,
            500,
            "EMAIL_SEND_FAILED"
        );
    }

    successResponse({
        res,
        status: 200,
        message: "OTP sent to your new email address",
        data: { newEmail },
    });
};

export const confirmChangeEmail = async (req, res, next) => {
    const { newEmail, otp } = req.body;
    const key = `change_email::${req.member._id}::${newEmail.toLowerCase()}`;
    const stored = await redis_service.getValuse({ key });
    if (!stored) {
        throw httpError("OTP expired or invalid request", 400, "OTP_EXPIRED");
    }
    if (!compareSync(String(otp), stored)) {
        throw httpError("Invalid OTP", 400, "OTP_INVALID");
    }

    await memberModel.findByIdAndUpdate(req.member._id, {
        email: newEmail.toLowerCase(),
    });
    await redis_service.delValuse([key]);

    successResponse({
        res,
        status: 200,
        message: "Email updated successfully",
        data: { email: newEmail.toLowerCase() },
    });
};

export const deleteAccount = async (req, res, next) => {
    const { password } = req.body;
    const member = await memberModel.findById(req.member._id);
    if (!member) throw httpError("User not found", 404, "USER_NOT_FOUND");

    if (member.provider === ProviderEnum.SYSTEM) {
        if (!password || !compareSync(password, member.password)) {
            throw httpError("Invalid password", 401, "INVALID_PASSWORD");
        }
    }

    await memberModel.findByIdAndDelete(member._id);
    await redis_service.delValuse(
        await redis_service.keys(redis_service.get_revoke_key({ memberId: member._id }))
    );

    successResponse({
        res,
        status: 200,
        message: "Account deleted successfully",
    });
};