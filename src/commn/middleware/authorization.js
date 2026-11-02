import { httpError } from "../utils/permissions.js";

export const authorization = (roles = []) => {
    return async (req, res, next) => {
        try {
            if (!req.member || !roles.includes(req.member.role)) {
                return res.status(403).json({
                    message: "Forbidden: insufficient permissions",
                    code: "FORBIDDEN",
                });
            }
            next();
        } catch (error) {
            next(error);
        }
    };
};