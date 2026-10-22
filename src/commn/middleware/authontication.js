
import {  findOne } from "../../DB/DB.service.js"
import memberModel from "../../DB/models/member.js";
import { ProviderEnum } from "../enums/member.enums.js";
import { verifyToken } from "../utils/security/token.service.js";
import { getValuse } from "../../DB/redis/redise.service.js";
import { JWT_SECRET } from "../../../config/config.env.js";
import { revoke_key } from "../../DB/redis/redise.service.js";

export const authonticaation = async (req, res, next) => {
    try {
        const { authorization } = req.headers;

        if (!authorization) {
            throw new Error("Authorization token is required");
        }

        const [prefix, token] = authorization.split(" ");

        if (prefix !== "Bearer" || !token) {
            throw new Error("Invalid authorization format");
        }

        const decoded = verifyToken({
            token,
            secret_key: JWT_SECRET,
        });

        if (!decoded?.id || !decoded?.iat || !decoded?.jti) {
            throw new Error("Invalid token payload");
        }

        const member = await findOne({
            model: memberModel,
            filter: {
                _id: decoded.id,
                provider: ProviderEnum.SYSTEM,
            },
            select: "-password",
        });

        if (!member) {
            throw new Error("Member not found. Please sign up.");
        }

const credentialsChangedAt = member.changeCredentials;

if (
    credentialsChangedAt &&
    credentialsChangedAt.getTime() > decoded.iat * 1000
) {
    throw new Error(
        "Token expired due to credential changes. Please log in again."
    );
}

        const revokeToken = await getValuse({
            key: revoke_key({
                memberId: member._id,
                jti: decoded.jti,
            }),
        });

        if (revokeToken) {
            throw new Error("Token revoked. Please log in again.");
        }

        req.decoded = decoded;
        req.member = member;

        return next();
    } catch (error) {
      console.error("Authentication Error:", error);

    return res.status(401).json({
        message: error.message || "Authentication failed",
    });
    }
};



