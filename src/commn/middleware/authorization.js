export const authorization = (roles = []) => {
    return async (req, res, next) => {

        if (!roles.includes(req.member.role)) {
            throw new Error("unauthorized");
        }
        next()
    }
}