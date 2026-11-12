
import {  findOne } from "../../DB/DB.service.js"
import memberModel from "../../DB/models/member.js";
import { ProviderEnum } from "../enums/member.enums.js";
import { verifyToken } from "../utils/security/token.service.js";
import { getValuse } from "../../DB/redis/redise.service.js";
import { JWT_SECRET } from "../../../config/config.env.js";
import { revoke_key } from "../../DB/redis/redise.service.js";
import { getRefreshCookie } from "../utils/auth-cookie.js";

const authenticate = (expectedType = "access") => async (req, res, next) => {
    try {
        const { authorization } = req.headers;
        let token = "";

        if (authorization) {
            const [prefix, rawToken] = authorization.split(" ");
            if (prefix === "Bearer" && rawToken) token = rawToken;
        }

        // Refresh tokens prefer the HttpOnly cookie; Bearer remains supported during migration.
        if (!token && expectedType === "refresh") token = getRefreshCookie(req);

        // Support query param ?access_token= for SSE / EventSource
        if (!token && req.query?.access_token) {
            token = req.query.access_token;
        }

        if (!token) {
            return res.status(401).json({
                message: "Authorization token is required",
                code: "UNAUTHORIZED",
            });
        }

        let decoded;
        try {
            decoded = verifyToken({
                token,
                secret_key: JWT_SECRET,
            });
        } catch (err) {
            return res.status(401).json({
                message: err.name === "TokenExpiredError" ? "Token expired" : "Invalid token",
                code: err.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
            });
        }

        if (!decoded?.id || !decoded?.iat || !decoded?.jti || decoded.type !== expectedType) {
            return res.status(401).json({
                message: `A valid ${expectedType} token is required`,
                code: "INVALID_TOKEN",
            });
        }

        // Fix B3: do not restrict provider to SYSTEM so Google users work on protected routes
        const member = await findOne({
            model: memberModel,
            filter: {
                _id: decoded.id,
            },
            select: "-password",
        });

        if (!member) {
            return res.status(401).json({
                message: "Member not found. Please sign up.",
                code: "USER_NOT_FOUND",
            });
        }
        if (member.active === false) {
            return res.status(403).json({
                message: "Account is deactivated. Contact an administrator.",
                code: "ACCOUNT_DEACTIVATED",
            });
        }

        const credentialsChangedAt = member.changeCredentials;
        if (
            credentialsChangedAt &&
            credentialsChangedAt.getTime() > decoded.iat * 1000
        ) {
            return res.status(401).json({
                message: "Token expired due to credential changes. Please log in again.",
                code: "TOKEN_EXPIRED",
            });
        }

        try {
            const revokeToken = await getValuse({
                key: revoke_key({
                    memberId: member._id,
                    jti: decoded.jti,
                }),
            });

            if (revokeToken) {
                return res.status(401).json({
                    message: "Token revoked. Please log in again.",
                    code: "TOKEN_REVOKED",
                });
            }
        } catch (e) {
            // Redis error should not block auth if unreachable
        }

        req.decoded = decoded;
        req.member = member;

        return next();
    } catch (error) {
        return res.status(401).json({
            message: error.message || "Authentication failed",
            code: "UNAUTHORIZED",
        });
    }
};

export const authonticaation = authenticate("access");
export const refreshAuthentication = authenticate("refresh");
export const authentication = authonticaation;




